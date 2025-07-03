import {parseCoAuthoredBy} from 'alinea/cli/util/CommitMessage'
import type {
  CommitApi,
  HistoryApi,
  Revision,
  SyncApi
} from 'alinea/core/Connection'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import {HttpError} from 'alinea/core/HttpError'
import type {CommitChange, CommitRequest} from 'alinea/core/db/CommitRequest'
import {
  GithubSource,
  type GithubSourceOptions
} from 'alinea/core/source/GithubSource'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {base64, btoa} from 'alinea/core/util/Encoding'
import {fileVersions} from 'alinea/core/util/EntryFilenames'
import {join} from 'alinea/core/util/Paths'

export interface GithubOptions extends GithubSourceOptions {
  author?: {name: string; email: string}
}

export class GithubApi
  extends GithubSource
  implements HistoryApi, CommitApi, SyncApi
{
  #options: GithubOptions

  constructor(options: GithubOptions) {
    super(options)
    this.#options = options
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    const currentCommit = await this.#getLatestCommitOid()
    const currentSha = await this.shaAt(currentCommit)

    if (currentSha !== request.fromSha)
      throw new ShaMismatchError(currentSha, request.fromSha)

    const {author} = this.#options

    let commitMessage = request.description
    if (author) {
      commitMessage += `\n\nCo-authored-by: ${author.name} <${author.email}>`
    }
    const newCommit = await this.#applyChangesToRepo(
      currentCommit,
      request.changes,
      commitMessage
    )

    return {sha: await this.shaAt(newCommit)}
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return this.#getFileCommitHistory(file)
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const content = await this.#getFileContentAtCommit(file, revisionId)
    try {
      return content ? (JSON.parse(content) as EntryRecord) : undefined
    } catch (error) {
      return undefined
    }
  }

  async #graphQL(query: string, variables: object, token: string) {
    return fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query, variables})
    })
      .then(async response => {
        if (response.ok) return response.json()
        throw new HttpError(response.status, await response.text())
      })
      .then(result => {
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          const message = result.errors.map((e: any) => e.message).join('; ')
          console.trace(result.errors)
          throw new Error(message)
        }
        return result
      })
  }

  async #getFileCommitHistory(file: string): Promise<Array<Revision>> {
    const {owner, repo, branch, authToken, rootDir} = this.#options
    const versions = fileVersions(file)
    const query = versions
      .map((file, index) => {
        const alias = `file${index}`
        const path = join(rootDir, file)
        return `
      ${alias}: history(path: "${path}", first: 100) {
        nodes {
          oid
          committedDate
          message
          author {
            name
            email
          }
        }
      }
    `
      })
      .join('')
    const result = await this.#graphQL(
      `query GetFileHistory($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              ${query}
            }
          }
        }
      }
    }`,
      {owner, repo, branch},
      authToken
    )
    const results = []

    for (const [index, file] of versions.entries()) {
      const alias = `file${index}`
      const commits = result.data.repository.ref.target[alias]?.nodes || []

      results.push(
        ...commits.map((commit: any) => ({
          ref: commit.oid,
          createdAt: new Date(commit.committedDate).getTime(),
          file,
          user:
            (parseCoAuthoredBy(commit.message) ?? commit.author)
              ? {name: commit.author.name, email: commit.author.email}
              : undefined,
          description: commit.message
        }))
      )
    }

    return results
  }

  async #getFileContentAtCommit(
    file: string,
    ref: string
  ): Promise<string | undefined> {
    const {owner, repo, authToken, rootDir} = this.#options
    const result = await this.#graphQL(
      `query GetFileContent($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Blob {
            text
          }
        }
      }
    }`,
      {owner, repo, expression: `${ref}:${join(rootDir, file)}`},
      authToken
    )
    return result.data.repository.object?.text
  }

  async #applyChangesToRepo(
    expectedHeadOid: string,
    changes: Array<CommitChange>,
    commitMessage: string
  ): Promise<string> {
    const {additions, deletions} = await this.#processChanges(changes)
    const {owner, repo, branch, authToken} = this.#options
    return this.#graphQL(
      `mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
        }
      }
    }`,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${owner}/${repo}`,
            branchName: branch
          },
          message: {headline: commitMessage},
          fileChanges: {additions, deletions},
          expectedHeadOid
        }
      },
      authToken
    )
      .then(result => {
        const commitId = result.data.createCommitOnBranch.commit.oid
        return commitId
      })
      .catch(error => {
        if (error instanceof Error) {
          const mismatchMessage = /is at ([a-z0-9]+) but expected ([a-z0-9]+)/
          const match = error.message.match(mismatchMessage)
          if (match) {
            const [_, actual, expected] = match
            throw new ShaMismatchError(actual, expected)
          }
          const expectedMessage = /Expected branch to point to "([a-z0-9]+)"/
          const expectedMatch = error.message.match(expectedMessage)
          if (expectedMatch) {
            const actualSha = expectedMatch[1]
            throw new ShaMismatchError(actualSha, expectedHeadOid)
          }
        }
        throw error
      })
  }

  async #processChanges(changes: Array<CommitChange>): Promise<{
    additions: {path: string; contents: string}[]
    deletions: {path: string}[]
  }> {
    const {rootDir} = this.#options
    const additions = Array<{path: string; contents: string}>()
    const deletions = Array<{path: string}>()

    for (const change of changes) {
      switch (change.op) {
        case 'addContent': {
          additions.push({
            path: join(this.contentLocation, change.path),
            contents: btoa(change.contents!)
          })
          break
        }
        case 'uploadFile': {
          const file = join(rootDir, change.location)
          additions.push({
            path: file,
            contents: await this.#fetchUploadedContent(change.url)
          })
          break
        }
        case 'deleteContent': {
          const file = join(this.contentLocation, change.path)
          deletions.push({path: file})
          break
        }
        case 'removeFile': {
          const file = join(rootDir, change.location)
          deletions.push({path: file})
          break
        }
      }
    }

    return {additions, deletions}
  }

  async #getLatestCommitOid(): Promise<string> {
    const {owner, repo, branch, authToken} = this.#options
    return this.#graphQL(
      `query GetLatestCommit($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            oid
          }
        }
      }
    }`,
      {owner, repo, branch},
      authToken
    ).then(result => result.data.repository.ref.target.oid)
  }

  async #fetchUploadedContent(url: string): Promise<string> {
    const response = await fetch(url)
    return base64.stringify(new Uint8Array(await response.arrayBuffer()))
  }
}
