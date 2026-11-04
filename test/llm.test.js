const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const askJson = require('../srv/lib/llm')

const { provider, redact } = askJson
const ask = () => askJson({
  system: 'Reply with JSON',
  user: 'Call me on 9876543210 or ravi@example.com',
  validate: o => Array.isArray(o?.tasks),
  fallback: { tasks: ['fallback'] }
})

// A stand-in for the API, so the real SDK runs without a key or any cost.
let server, reply, received, status = 200
before(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, body: JSON.parse(body) })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply()))
    })
  })
  await new Promise(resolve => server.listen(0, resolve))
})
after(() => server.close())
beforeEach(() => {
  received = []
  status = 200
  for (const key of ['AICORE_SERVICE_KEY', 'VCAP_SERVICES', 'LLM_MODEL', 'GEMINI_API_KEY', 'META_API_KEY', 'META_MODEL', 'META_REASONING_EFFORT']) delete process.env[key]
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.ANTHROPIC_BASE_URL = process.env.GEMINI_BASE_URL = process.env.META_BASE_URL = `http://localhost:${server.address().port}`
})

const message = (text, stop_reason = 'end_turn') => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'test', stop_reason, stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }
})

test('provider: Generative AI Hub wins, then direct, then offline', () => {
  assert.equal(provider(), 'direct-anthropic')
  process.env.AICORE_SERVICE_KEY = '{}'
  assert.equal(provider(), 'direct-anthropic', 'the Hub also needs a model name')
  process.env.LLM_MODEL = 'some-model'
  assert.equal(provider(), 'generative-ai-hub')
  delete process.env.AICORE_SERVICE_KEY
  delete process.env.ANTHROPIC_API_KEY
  assert.equal(provider(), 'offline')
})

test('direct: returns parsed JSON and sends redacted text', async () => {
  reply = () => message('```json\n{"tasks":["count"]}\n```')
  const { value, degraded } = await ask()
  assert.deepEqual(value.tasks, ['count'])
  assert.equal(degraded, false)
  const { body } = received[0]
  assert.equal(body.model, 'claude-opus-5-5')
  assert.equal(body.messages[0].content, 'Call me on [phone] or [email]')
})

test('direct: a refusal ends in the marked fallback', async () => {
  reply = () => message('', 'refusal')
  const { value, degraded } = await ask()
  assert.equal(degraded, true)
  assert.deepEqual(value.tasks, ['fallback'])
  assert.equal(received.length, 2)
})

test('direct: a bad answer is retried once', async () => {
  const answers = ['not json', '{"tasks":["second try"]}']
  reply = () => message(answers.shift())
  const { value, degraded } = await ask()
  assert.equal(degraded, false)
  assert.deepEqual(value.tasks, ['second try'])
})

test('offline: no key means the fallback, with no network call', async () => {
  delete process.env.ANTHROPIC_API_KEY
  const { degraded } = await ask()
  assert.equal(degraded, true)
  assert.equal(received.length, 0)
})

test('redact: leaves ordinary numbers alone', () => {
  assert.equal(redact('I count 48 bins, 300 a year'), 'I count 48 bins, 300 a year')
  assert.equal(redact('+91 98765 43210'), '[phone]')
})

// Google Gemini: used only when no Hub and no Anthropic key.
const gemini = text => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] })
const useGemini = () => { delete process.env.ANTHROPIC_API_KEY; process.env.GEMINI_API_KEY = 'gem-key' }

test('provider: Gemini comes after Anthropic and before offline', () => {
  process.env.GEMINI_API_KEY = 'gem-key'
  assert.equal(provider(), 'direct-anthropic')
  delete process.env.ANTHROPIC_API_KEY
  assert.equal(provider(), 'direct-gemini')
  delete process.env.GEMINI_API_KEY
  assert.equal(provider(), 'offline')
})

test('gemini: returns parsed JSON, sends redacted text and the key header', async () => {
  useGemini()
  reply = () => gemini('{"tasks":["count"]}')
  const { value, degraded } = await ask()
  assert.deepEqual(value.tasks, ['count'])
  assert.equal(degraded, false)
  const { url, headers, body } = received[0]
  assert.equal(url, '/v1beta/models/gemini-3.8-flash:generateContent')
  assert.equal(headers['x-goog-api-key'], 'gem-key')
  assert.equal(body.contents[0].parts[0].text, 'Call me on [phone] or [email]')
  assert.equal(body.generationConfig.responseMimeType, 'application/json')
})

test('gemini: a bad answer is retried once', async () => {
  useGemini()
  const answers = ['not json', '{"tasks":["second try"]}']
  reply = () => gemini(answers.shift())
  const { value, degraded } = await ask()
  assert.equal(degraded, false)
  assert.deepEqual(value.tasks, ['second try'])
})

test('gemini: a rate limit goes straight to the marked fallback, with no retry', async () => {
  useGemini()
  status = 429
  reply = () => ({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } })
  const { value, degraded } = await ask()
  assert.equal(degraded, true)
  assert.deepEqual(value.tasks, ['fallback'])
  assert.equal(received.length, 1)
})

test('gemini: a blocked prompt ends in the marked fallback', async () => {
  useGemini()
  reply = () => ({ promptFeedback: { blockReason: 'SAFETY' } })
  const { degraded } = await ask()
  assert.equal(degraded, true)
})

// Meta's Model API: used only when no Hub, Anthropic or Gemini key.
const meta = content => ({ id: 'chat_test', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] })
const useMeta = () => { delete process.env.ANTHROPIC_API_KEY; process.env.META_API_KEY = 'meta-key' }

test('provider: Meta comes after Gemini and before offline', () => {
  useMeta()
  process.env.GEMINI_API_KEY = 'gem-key'
  assert.equal(provider(), 'direct-gemini')
  delete process.env.GEMINI_API_KEY
  assert.equal(provider(), 'direct-meta')
})

test('meta: returns parsed JSON, sends redacted text, the model and the bearer key', async () => {
  useMeta()
  process.env.META_MODEL = 'muse-test'
  reply = () => meta('```json\n{"tasks":["count"]}\n```')
  const { value, degraded } = await ask()
  assert.deepEqual(value.tasks, ['count'])
  assert.equal(degraded, false)
  const { url, headers, body } = received[0]
  assert.equal(url, '/chat/completions')
  assert.equal(headers.authorization, 'Bearer meta-key')
  assert.equal(body.model, 'muse-test')
  assert.equal(body.messages[1].content, 'Call me on [phone] or [email]')
  assert.equal(body.reasoning_effort, 'low', 'low effort by default, for speed on stage')
})

test('meta: a wrong key ends in the marked fallback', async () => {
  useMeta()
  status = 401
  reply = () => ({ error: { message: 'invalid key' } })
  const { degraded } = await ask()
  assert.equal(degraded, true)
})
