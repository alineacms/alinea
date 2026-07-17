import {GithubApi, type GithubOptions} from './GithubApi.js'
import type {BackendPart} from './CreateBackend.js'

export function github(options: GithubOptions): BackendPart {
  return context => {
    const {user} = context
    const author =
      user?.name && user.email
        ? {name: user.name, email: user.email}
        : undefined
    return new GithubApi({author, ...options})
  }
}
