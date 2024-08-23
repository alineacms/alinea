import {Auth} from 'alinea/backend/Backend'
import {localUser} from 'alinea/core/User'
import PLazy from 'p-lazy'
import {SimpleGit} from 'simple-git'

export function localAuth(git: SimpleGit): Auth {
  const user = PLazy.from(async () => {
    const [name = localUser.name, email] = (
      await Promise.all([
        git.getConfig('user.name'),
        git.getConfig('user.email')
      ])
    ).map(res => res.value ?? undefined)
    return {...localUser, name, email}
  })
  return {
    async authenticate(ctx, request) {
      return new Response('ok')
    },
    async verify(ctx, request) {
      return {...ctx, user: await user, token: 'dev'}
    }
  }
}
