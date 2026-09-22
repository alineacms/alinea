// Queries are forwarded to the handler in the Edge runtime, which carries no
// generated database. Next.js 16.3 drops `runtime = 'edge'`, so this entry
// only keeps existing setups working until it is phased out.
export {createCMS, type SyncStatus} from '#/adapter/next/cms.js'
export {createHandler, type NextHandlerOptions} from '#/adapter/next/handler.js'
export type {
  AfterCommitContext,
  BeforeCommitContext
} from '#/backend/Handler.js'
