import {MemoryDrafts} from 'alinea/cli/serve/MemoryDrafts'
import {Connection} from 'alinea/core/Connection'
import {createId} from 'alinea/core/Id'
import {localUser} from 'alinea/core/User'
import {Auth, Backend, History, Media, Target} from '../Backend.js'
import {Database} from '../Database.js'

export function memoryBackend(db: Database): Backend {
  const pending: Array<Connection.MutateParams & {toCommitHash: string}> = []
  const auth: Auth = {
    async authenticate() {
      return new Response('ok')
    },
    async verify(ctx) {
      return {...ctx, user: localUser, token: 'dev'}
    }
  }
  const target: Target = {
    async mutate(ctx, params) {
      const mutations = params.mutations.flatMap(mutate => mutate.meta)
      const toCommitHash = createId()
      await db.applyMutations(mutations, toCommitHash)
      pending.push({...params, toCommitHash})
      return {commitHash: toCommitHash}
    }
  }
  const media: Media = {
    prepareUpload(ctx, file) {
      throw new Error(`Not implemented`)
    }
  }
  const drafts = new MemoryDrafts()
  const history: History = {
    async list(ctx, file) {
      return []
    },
    async revision(ctx, file, ref) {
      throw new Error(`Not implemented`)
    }
  }
  return {
    auth,
    target,
    media,
    drafts,
    history
  }
}
