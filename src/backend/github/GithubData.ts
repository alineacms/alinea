import {fetch} from '@alinea/iso'
import {Octokit} from '@octokit/rest'
import type {Data} from 'alinea/backend/Data'
import type {Loader} from 'alinea/backend/Loader'
import {Config, createError, Hub} from 'alinea/core'
import {join} from 'alinea/core/util/Paths'
import createOrUpdateFiles from 'octokit-commit-multiple-files/create-or-update-files.js'

export type GithubTargetOptions = {
  config: Config
  loader: Loader
  rootDir?: string
  githubAuthToken: string
  owner: string
  repo: string
  branch: string
  author: {
    name: string
    email: string
  }
}

export class GithubData implements Data.Target, Data.Media {
  canRename = false
  octokit: Octokit

  constructor(protected options: GithubTargetOptions) {
    this.octokit = new Octokit({auth: options.githubAuthToken})
  }

  async publish({changes}: Hub.ChangesParams, ctx: Hub.Context) {
    const {rootDir = '.'} = this.options
    return createOrUpdateFiles(this.octokit, {
      owner: this.options.owner,
      repo: this.options.repo,
      branch: this.options.branch,
      author: this.options.author,
      changes: [
        {
          message: 'Update content',
          files: Object.fromEntries(
            changes.write.map(({file, contents}) => {
              return [join(rootDir, file), contents]
            })
          ),
          filesToDelete: changes.delete.map(({file}) => join(rootDir, file))
        }
      ]
    })
  }

  async upload({fileLocation, buffer}: Hub.MediaUploadParams): Promise<string> {
    const {rootDir = '.', owner, repo, branch, author} = this.options
    const location = join(rootDir, fileLocation)
    const changes = {[location]: buffer}
    await createOrUpdateFiles(this.octokit, {
      owner,
      repo,
      branch,
      author,
      changes: [
        {
          message: 'Upload files',
          files: changes
        }
      ]
    })
    return location
  }

  async download({location}: Hub.DownloadParams): Promise<Hub.Download> {
    const {rootDir = '.', owner, repo, branch} = this.options
    const pathname = join(rootDir, owner, repo, branch, location)
    const url = `https://raw.githubusercontent.com/${pathname}`
    const res = await fetch(url, {
      headers: {
        authorization: `token ${this.options.githubAuthToken}`,
        accept: `application/vnd.github.v3.raw`
      }
    })
    if (!res.body) throw createError(404)
    return {type: 'buffer', buffer: await res.arrayBuffer()}
  }
}
