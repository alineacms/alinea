import {GithubApi, type GithubOptions} from './GithubApi.js'
import type {BackendPart} from './CreateBackend.js'

export function github(options: GithubOptions): BackendPart {
  return () => new GithubApi(options)
}
