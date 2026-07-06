// Example of a sensitive action gated by Kiriakou on the server.
// `assertHuman` is auto-imported by the module; it throws 428 if the request
// does not carry a valid, unexpired humanity token.
export default defineEventHandler((event) => {
  assertHuman(event)
  // ...perform the real, sensitive operation here...
  return { ok: true, at: Date.now() }
})
