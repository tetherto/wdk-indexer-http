'use strict'

// Resolved through the "#fetch" import map; Bare gets bare-fetch instead.
// Looked up per call so a fetch installed after load is still picked up.
/** @type {typeof globalThis.fetch} */
module.exports = function fetch (...args) {
  return globalThis.fetch(...args)
}
