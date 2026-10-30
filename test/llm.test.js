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
let server, reply, received
before(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, body: JSON.parse(body) })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply()))
    })
  })
  await new Promise(resolve => server.listen(0, resolve))
})
after(() => server.close())
beforeEach(() => {
  received = []
  for (const key of ['AICORE_SERVICE_KEY', 'VCAP_SERVICES', 'LLM_MODEL']) delete process.env[key]
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${server.address().port}`
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
