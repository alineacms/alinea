import {Entry, Schema} from '@alinea/core'
import {Octokit} from '@octokit/rest'
import createOrUpdateFiles from 'octokit-commit-multiple-files/create-or-update-files.js'
import {posix as path} from 'path'
import {Loader} from '../Loader'
import {Target} from '../Target'

export type GithubTargetOptions = {
  schema: Schema
  loader: Loader
  contentDir: string
  githubAuthToken: string
  owner: string
  repo: string
  branch: string
  author: {
    name: string
    email: string
  }
}

export class GithubTarget implements Target {
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
      return [location, loader.format(schema, data)]
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
}
