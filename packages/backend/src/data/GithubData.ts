import {Config, createError, createId, Hub, slugify} from '@alinea/core'
import {Octokit} from '@octokit/rest'
import {posix as path} from 'node:path'
import createOrUpdateFiles from 'octokit-commit-multiple-files/create-or-update-files.js'
import {Data} from '../Data'
import {Loader} from '../Loader'

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
              return [path.join(rootDir, file), contents]
            })
          ),
          filesToDelete: changes.delete.map(({file}) =>
            path.join(rootDir, file)
          )
        }
      ]
    })
  }

  async upload({workspace, ...file}: Hub.UploadParams): Promise<string> {
    const {config, rootDir = '.', owner, repo, branch, author} = this.options
    const {mediaDir} = config.workspaces[workspace]
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const dir = path.dirname(file.path)
    const extension = path.extname(file.path)
    const name = path.basename(file.path, extension)
    const fileName = `${slugify(name)}.${createId()}${extension}`
    const location = path.join(rootDir, mediaDir, dir, fileName)
    const changes = {[location]: file.buffer}
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

  async download({
    workspace,
    location
  }: Hub.DownloadParams): Promise<Hub.Download> {
    const {config, rootDir = '.', owner, repo, branch} = this.options
    const {mediaDir} = config.workspaces[workspace]
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const file = path.join(mediaDir, location)
    const pathname = path.join(rootDir, owner, repo, branch, file)
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
