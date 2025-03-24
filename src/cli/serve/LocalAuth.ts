import type {Auth} from 'alinea/backend/Backend'
import {gitUser} from 'alinea/backend/util/ExecGit'

export function localAuth(rootDir: string): Auth {
  const user = gitUser(rootDir)
  return {
    async authenticate(ctx, request) {
      return new Response('ok')
    },
    async verify(ctx, request) {
      return {...ctx, user: await user, token: 'dev'}
    }
  }
}
