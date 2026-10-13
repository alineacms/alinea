// Alinea modules read process.env: the page is a production deployment's
// dashboard host. Import this before any Alinea module.
;(globalThis as {process?: unknown}).process ??= {
  env: {NODE_ENV: 'production'}
}
