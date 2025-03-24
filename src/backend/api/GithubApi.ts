import type {Connection} from 'alinea/core/Connection'
import type {EntryRecord} from 'alinea/core/EntryRecord'
import {HttpError} from 'alinea/core/HttpError'
import {base64, btoa} from 'alinea/core/util/Encoding'
import {join} from 'alinea/core/util/Paths'
import type {AuthedContext, History, Revision, Target} from '../Backend.js'
import {type Change, ChangeType} from '../data/ChangeSet.js'
import {applyJsonPatch} from '../util/JsonPatch.js'

export interface GithubOptions {
  authToken: string
  owner: string
  repo: string
  branch: string
  rootDir?: string
}

export function githubApi(options: GithubOptions) {
  const target: Target = {
    async mutate(
      ctx: AuthedContext,
      params: Connection.MutateParams
    ): Promise<{commitHash: string}> {
      let commitMessage = 'Alinea content update'
      if (ctx.user.email && ctx.user.name)
        commitMessage += `\nCo-authored-by: ${ctx.user.name} <${ctx.user.email}>`
      return {
        commitHash: await applyChangesToRepo(
          options,
          params.mutations.flatMap(m => {
            return m.changes
          }),
          commitMessage
        )
      }
    }
  }
  const history: History = {
    async list(ctx, file): Promise<Array<Revision>> {
      return getFileCommitHistory(options, file)
    },
    async revision(ctx, file, ref): Promise<EntryRecord | undefined> {
      const content = await getFileContentAtCommit(options, file, ref)
      try {
        return content ? (JSON.parse(content) as EntryRecord) : undefined
      } catch (error) {
        return undefined
      }
    }
  }
  return {target, history}
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
  changes: Array<Change>,
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
  options: GithubOptions,
  changes: Change[]
): Promise<{
  additions: {path: string; contents: string}[]
  deletions: {path: string}[]
}> {
  const additions: {path: string; contents: string}[] = []
  const deletions: {path: string}[] = []

  for (const change of changes) {
    switch (change.type) {
      case ChangeType.Write:
      case ChangeType.Upload: {
        const file = join(options.rootDir, change.file)
        additions.push({
          path: file,
          contents:
            change.type === ChangeType.Write
              ? btoa(change.contents)
              : await fetchUploadedContent(change.url)
        })
        break
      }
      case ChangeType.Delete: {
        const file = join(options.rootDir, change.file)
        deletions.push({path: file})
        break
      }
      case ChangeType.Rename: {
        const from = join(options.rootDir, change.from)
        const to = join(options.rootDir, change.to)
        const isFolder = await isPathFolder(options, from)
        if (isFolder) {
          const files = await listFilesInFolder(options, from)
          const contents = await Promise.all(
            files.map(file => fetchFileContent(options, file))
          )
          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            deletions.push({path: file})
            const path = to + file.slice(from.length)
            additions.push({
              path,
              contents: contents[i]
            })
          }
        } else {
          deletions.push({path: from})
          additions.push({
            path: join(options.rootDir, to),
            contents: await fetchFileContent(options, from)
          })
        }
        break
      }
      case ChangeType.Patch: {
        const file = join(options.rootDir, change.file)
        const currentContent = await fetchFileContent(options, file)
        const patchedContent = applyPatch(currentContent, change.patch)
        additions.push({
          path: file,
          contents: btoa(patchedContent)
        })
        break
      }
    }
  }

  return {additions, deletions}
}

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

async function isPathFolder(
  {owner, repo, branch, authToken}: GithubOptions,
  path: string
): Promise<boolean> {
  return graphQL(
    `query IsPathFolder($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              name
            }
          }
        }
      }
    }
  `,
    {owner, repo, expression: `${branch}:${path}`},
    authToken
  ).then(result => result.data.repository.object !== null)
}

async function listFilesInFolder(
  {owner, repo, branch, authToken}: GithubOptions,
  path: string
): Promise<string[]> {
  return graphQL(
    `query ListFiles($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              name
              type
              object {
                ... on Blob {
                  oid
                }
                ... on Tree {
                  entries {
                    name
                    type
                    object {
                      ... on Blob {
                        oid
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
    {owner, repo, expression: `${branch}:${path}`},
    authToken
  ).then(result => flattenFileList(result.data.repository.object.entries, path))
}

function flattenFileList(entries: any[], basePath: string): string[] {
  let files: string[] = []
  for (const entry of entries) {
    if (entry.type === 'blob') {
      files.push(`${basePath}/${entry.name}`)
    } else if (entry.type === 'tree') {
      files = files.concat(
        flattenFileList(entry.object.entries, `${basePath}/${entry.name}`)
      )
    }
  }
  return files
}

async function fetchFileContent(
  {owner, repo, branch, authToken}: GithubOptions,
  path: string
): Promise<string> {
  return graphQL(
    `query GetFileContent($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Blob {
            text
          }
        }
      }
    }
  `,
    {owner, repo, expression: `${branch}:${path}`},
    authToken
  ).then(result => result.data.repository.object.text)
}

async function fetchUploadedContent(url: string): Promise<string> {
  const response = await fetch(url)
  return base64.stringify(new Uint8Array(await response.arrayBuffer()))
}

function applyPatch(content: string, patch: object): string {
  try {
    // Parse the content as JSON
    const jsonContent = JSON.parse(content)

    // Apply the JSON patch
    applyJsonPatch(jsonContent, patch)

    // Stringify the patched content back to a string
    return JSON.stringify(jsonContent, null, 2)
  } catch (error) {
    console.error('Error applying patch:', error)
    return content // Return original content if patching fails
  }
}
