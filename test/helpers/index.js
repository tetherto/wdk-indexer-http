'use strict'

// Shared fixtures for the unit tests.

// Minimal stand-in for a fetch Response.
function reply (status, body, statusText = '') {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  return { ok: status >= 200 && status < 300, status, statusText, text: async () => text }
}

// Mock fetch that records every call and answers with `respond`.
function mockFetch (respond = () => reply(200, { ok: true })) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, ...init })
    return respond(url, init)
  }
  fetch.calls = calls
  return fetch
}

// Await a rejection, check its class and message, and return it.
async function rejects (t, promise, ErrorClass, pattern) {
  try {
    await promise
  } catch (err) {
    t.ok(err instanceof ErrorClass, 'is ' + ErrorClass.name)
    t.ok(pattern.test(err.message), err.message)
    return err
  }
  t.fail('should reject')
  return {}
}

module.exports = { reply, mockFetch, rejects }
