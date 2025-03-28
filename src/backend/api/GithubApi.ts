import type {
  AuthedContext,
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
import {base64, btoa} from 'alinea/core/util/Encoding'
import {join} from 'alinea/core/util/Paths'

export interface GithubOptions extends GithubSourceOptions {
  rootDir: string
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

  async commit(request: CommitRequest, ctx: AuthedContext): Promise<string> {
    let commitMessage = request.description
    if (ctx.user.email && ctx.user.name)
      commitMessage += `\nCo-authored-by: ${ctx.user.name} <${ctx.user.email}>`
    await applyChangesToRepo(this.#options, request.changes, commitMessage)
    return this.getTree().then(tree => tree.sha)
  }

  async revisions(file: string): Promise<Array<Revision>> {
    return getFileCommitHistory(this.#options, file)
  }

  async revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    const content = await getFileContentAtCommit(
      this.#options,
      file,
      revisionId
    )
    try {
      return content ? (JSON.parse(content) as EntryRecord) : undefined
    } catch (error) {
      return undefined
    }
  }
}

function graphQL(query: string, variables: object, token: string) {
  return fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query, variables})
  }).then(async response => {
    if (response.ok) return response.json()
    throw new HttpError(response.status, await response.text())
  })
}

async function getFileCommitHistory(
  {owner, repo, branch, authToken, rootDir}: GithubOptions,
  file: string
): Promise<Array<Revision>> {
  const result = await graphQL(
    `query GetFileHistory($owner: String!, $repo: String!, $branch: String!, $path: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              history(path: $path, first: 100) {
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
            }
          }
        }
      }
    }`,
    {owner, repo, branch, path: join(rootDir, file)},
    authToken
  )
  const commits = result.data.repository.ref.target.history.nodes

  return commits.map((commit: any) => ({
    ref: commit.oid,
    createdAt: new Date(commit.committedDate).getTime(),
    file,
    user: commit.author
      ? {name: commit.author.name, email: commit.author.email}
      : undefined,
    description: commit.message
  }))
}

async function getFileContentAtCommit(
  {owner, repo, authToken, rootDir}: GithubOptions,
  file: string,
  ref: string
): Promise<string | undefined> {
  const result = await graphQL(
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

async function applyChangesToRepo(
  options: GithubOptions,
  changes: Array<CommitChange>,
  commitMessage: string
): Promise<string> {
  const {additions, deletions} = await processChanges(options, changes)
  const {owner, repo, branch, authToken} = options
  return graphQL(
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
        message: {
          headline: commitMessage
        },
        fileChanges: {
          additions,
          deletions
        },
        expectedHeadOid: await getLatestCommitOid(options)
      }
    },
    authToken
  ).then(result => result.data.createCommitOnBranch.commit.oid)
}

async function processChanges(
  {rootDir, contentDir}: GithubOptions,
  changes: Array<CommitChange>
): Promise<{
  additions: {path: string; contents: string}[]
  deletions: {path: string}[]
}> {
  const additions = Array<{path: string; contents: string}>()
  const deletions = Array<{path: string}>()

  for (const change of changes) {
    switch (change.op) {
      case 'addContent': {
        additions.push({
          path: join(contentDir, change.path),
          contents: btoa(change.contents!)
        })
        break
      }
      case 'uploadFile': {
        const file = join(rootDir, change.location)
        additions.push({
          path: file,
          contents: await fetchUploadedContent(change.url)
        })
        break
      }
      case 'deleteContent': {
        const file = join(contentDir, change.path)
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

// sync: fetch this first and run checks
async function getLatestCommitOid({
  owner,
  repo,
  branch,
  authToken
}: GithubOptions): Promise<string> {
  return graphQL(
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

async function fetchUploadedContent(url: string): Promise<string> {
  const response = await fetch(url)
  return base64.stringify(new Uint8Array(await response.arrayBuffer()))
}
