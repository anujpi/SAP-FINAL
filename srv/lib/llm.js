// One door to Generative AI Hub. Without an AI Core binding, or after two bad answers, it returns the fallback marked degraded.
const MASKED = ['profile-person', 'profile-email', 'profile-phone', 'profile-nationalid']

const hasAiCore = () => Boolean(process.env.AICORE_SERVICE_KEY || process.env.VCAP_SERVICES?.includes('"aicore"'))

async function complete(system, user) {
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

const parseJson = text => JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))

async function askJson({ system, user, validate, fallback }) {
  if (!hasAiCore() || !process.env.LLM_MODEL) return { value: fallback, degraded: true }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = parseJson(await complete(system, user))
      if (validate(value)) return { value, degraded: false }
    } catch (e) {
      console.error('LLM call failed:', e.message)
    }
  }
  return { value: fallback, degraded: true }
}

module.exports = askJson
