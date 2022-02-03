import {createError, createId, Entry, Schema, slugify} from '@alinea/core'
import {Octokit} from '@octokit/rest'
import createOrUpdateFiles from 'octokit-commit-multiple-files/create-or-update-files.js'
import {posix as path} from 'path'
import {Data} from '../Data'
import {Loader} from '../Loader'

export type GithubTargetOptions = {
  schema: Schema
  loader: Loader
  contentDir: string
  mediaDir?: string
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
  octokit: Octokit

  constructor(protected options: GithubTargetOptions) {
    this.octokit = new Octokit({auth: options.githubAuthToken})
  }

  async publish(entries: Array<Entry>) {
    const {schema, contentDir, loader} = this.options
    const changes = entries.map(entry => {
      const {url, $parent, $isContainer, ...data} = entry
      const file = entry.url + ($isContainer ? 'index' : '') + loader.extension
      const location = path.join(contentDir, file)
      return [location, loader.format(schema, data)] as const
    })
    return createOrUpdateFiles(this.octokit, {
      owner: this.options.owner,
      repo: this.options.repo,
      branch: this.options.branch,
      author: this.options.author,
      changes: [
        {
          message: 'Update content',
          files: Object.fromEntries(changes)
        }
      ]
    })
  }

  async upload(file: Data.Media.Upload): Promise<string> {
    const {mediaDir, owner, repo, branch, author} = this.options
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const dir = path.dirname(file.path)
    const extension = path.extname(file.path)
    const name = path.basename(file.path, extension)
    const fileName = `${slugify(name)}.${createId()}${extension}`
    const location = path.join(mediaDir, dir, fileName)
    const changes = {[location]: file.buffer}
    await createOrUpdateFiles(this.octokit, {
      owner,
      repo,
      branch,
      author,
      changes: [
        {
          message: 'Upload files [skip ci]',
          files: changes
        }
      ]
    })
    return location
  }

  async download(location: string): Promise<Data.Media.Download> {
    const {mediaDir, owner, repo, branch} = this.options
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const file = path.join(mediaDir, location)
    const pathname = path.join(owner, repo, branch, file)
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

  /*async list(location?: string): Promise<Array<Media.DirEntry>> {
    const {mediaDir, owner, repo, branch, author} = this.options
    const contents = await this.octokit.repos.getContent({
      owner,
      repo,
      ref: branch,
      path: location ? path.join(mediaDir, location) : mediaDir
    })
    if (!Array.isArray(contents)) throw createError(404)
    return contents.map(entry => {
      return {
        type: entry.type === 'dir' ? 'directory' : 'file',
        path: entry.path,
        stat: {size: entry.size}
      }
    })
  }*/
}
