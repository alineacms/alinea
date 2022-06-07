# Changelog

## [Unreleased]

- Update number field styles to use updated css variable names

## [0.1.1]

- Fix subtle crypto import for node versions that ship it natively (> v15)

## [0.1.0]

- The backend implementation now uses the web fetch api instead of relying on
  express. This maximises compatibility with existing Javascript runtimes that
  are not node based (service worker, Cloudflare workers, deno, bun.js).
  Actually deploying the backend to platforms other than node has not been
  tested yet and might require a few additional changes. The fetch api is
  polyfilled for node using @remix-run/web-fetch. Eventually node will support
  this natively.
- Add an initial implementation of a date field (@alinea/input.date).
  It currently uses the native browser input which represents dates as ISO8601.
- The number field had an update to make it functional again.
