import type {
  Auth,
  Backend,
  Drafts,
  History,
  Media,
  Pending,
  Target
} from 'alinea/backend/Backend'
import {gitUser} from 'alinea/backend/util/ExecGit'
import {GitHistory} from 'alinea/cli/serve/GitHistory'
import type {Config} from 'alinea/core/Config'
import type {Connection} from 'alinea/core/Connection'
import type {Draft} from 'alinea/core/Draft'
import {createId} from 'alinea/core/Id'

const latency = 0

const lag = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function cloudDebug(config: Config, rootDir: string): Backend {
  const draftCache = new Map<string, Draft>()
  const mutations: Array<Connection.MutateParams & {toCommitHash: string}> = []
  const user = gitUser(rootDir)
  const gitHistory = new GitHistory(config, rootDir)
  const auth: Auth = {
    async authenticate(ctx, request) {
      return new Response('ok')
    },
    async verify(ctx, request) {
      return {...ctx, user: await user, token: 'dev'}
    }
  }
  const target: Target = {
    async mutate(ctx, params) {
      await lag(latency)
      for (const mutation of params.mutations) {
        console.info(
          `> cloud: mutate ${mutation.meta.type} - ${mutation.meta.entryId}`
        )
      }
      const toCommitHash = createId()
      mutations.push({...params, toCommitHash})
      console.info(`> cloud: current ${toCommitHash}`)
      return {commitHash: toCommitHash}
    }
  }
  const media: Media = {
    prepareUpload(ctx, file) {
      throw new Error('Not implemented')
    }
  }
  const drafts: Drafts = {
    async get(ctx, entryId) {
      await lag(latency)
      return draftCache.get(entryId)
    },
    async store(ctx, draft) {
      await lag(latency)
      console.info(`> cloud: store draft ${draft.entryId}`)
      draftCache.set(draft.entryId, draft)
    }
  }
  const history: History = {
    async list(ctx, file) {
      await lag(latency)
      return gitHistory.list(ctx, file)
    },
    async revision(ctx, file, ref) {
      await lag(latency)
      return gitHistory.revision(ctx, file, ref)
    }
  }
  const pending: Pending = {
    async since(ctx, commitHash) {
      await lag(latency)
      console.info(`> cloud: pending since ${commitHash}`)
      let i = mutations.length
      for (; i >= 0; i--)
        if (i > 0 && mutations[i - 1].toCommitHash === commitHash) break
      const pending = mutations.slice(i)
      if (pending.length === 0) return undefined
      return {
        toCommitHash: pending[pending.length - 1].toCommitHash,
        mutations: pending.flatMap(params =>
          params.mutations.flatMap(mutate => mutate.meta)
        )
      }
    }
  }
  return {auth, target, media, drafts, history, pending}
}
