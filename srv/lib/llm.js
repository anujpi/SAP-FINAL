// One door to the LLM. Order: Generative AI Hub, then the direct Anthropic backup, then a marked offline fallback.
const MASKED = ['profile-person', 'profile-email', 'profile-phone', 'profile-nationalid']
const DIRECT_MODEL = 'claude-opus-5-5'

const hasAiCore = () => Boolean(process.env.AICORE_SERVICE_KEY || process.env.VCAP_SERVICES?.includes('"aicore"'))

function provider() {
  if (hasAiCore() && process.env.LLM_MODEL) return 'generative-ai-hub'
  if (process.env.ANTHROPIC_API_KEY) return 'direct-anthropic'
  return 'offline'
}

// ponytail: catches emails and phone numbers only, not names. The direct route has no SAP masking,
// so a real deployment must use Generative AI Hub. All demo data is fictional.
const redact = text => text
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
  .replace(/(?<!\d)\+?\d(?:[\s-]?\d){9,12}(?!\d)/g, '[phone]')

async function completeHub(system, user) {
  // The SDK is ESM only, so it loads with import().
  const { OrchestrationClient, buildDpiMaskingProvider } = await import('@sap-ai-sdk/orchestration')
  const client = new OrchestrationClient({
    promptTemplating: {
      model: { name: process.env.LLM_MODEL },
      prompt: { template: [{ role: 'system', content: system }, { role: 'user', content: '{{?input}}' }] }
    },
    masking: { masking_providers: [buildDpiMaskingProvider({ method: 'anonymization', entities: MASKED })] }
  })
  const response = await client.chatCompletion({ placeholderValues: { input: user } })
  return response.getContent()
}

async function completeDirect(system, user) {
  const { default: Anthropic } = require('@anthropic-ai/sdk')
  // askJson already retries, and a stage demo can't wait out the SDK's 10-minute default.
  const client = new Anthropic({ timeout: 45_000, maxRetries: 0 })
  const response = await client.beta.messages.create({
    model: process.env.LLM_MODEL || DIRECT_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system,
    messages: [{ role: 'user', content: redact(user) }]
  })
  if (response.stop_reason === 'refusal') throw new Error('The model declined this request')
  return response.content.find(block => block.type === 'text')?.text ?? ''
}

const parseJson = text => JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))

async function askJson({ system, user, validate, fallback }) {
  const active = provider()
  if (active === 'offline') return { value: fallback, degraded: true }
  const complete = active === 'generative-ai-hub' ? completeHub : completeDirect

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = parseJson(await complete(system, user))
      if (validate(value)) return { value, degraded: false }
    } catch (e) {
      console.error(`LLM call failed (${active}):`, e.message)
    }
  }
  return { value: fallback, degraded: true }
}

module.exports = askJson
module.exports.provider = provider
module.exports.redact = redact
