import {Connection} from 'alinea/core/Connection'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {base64, btoa} from 'alinea/core/util/Encoding'
import {AuthedContext, History, Media, Revision, Target} from '../Backend.js'
import {Change, ChangeType} from '../data/ChangeSet.js'
import {applyJsonPatch} from '../util/JsonPatch.js'

export interface GithubOptions {
  authToken: string
  owner: string
  repo: string
  branch: string
}

export function githubApi({authToken, owner, repo, branch}: GithubOptions) {
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
          owner,
          repo,
          branch,
          params.mutations.flatMap(m => {
            return m.changes
          }),
          commitMessage,
          authToken
        )
      }
    }
  }
  const history: History = {
    async list(ctx, file): Promise<Array<Revision>> {
      return []
    },
    async revision(ctx, file, ref): Promise<EntryRecord> {
      throw new Error('Not implemented')
    }
  }
  const media: Media = {
    async prepareUpload(ctx, file) {
      return undefined!
    },
    async handleUpload(ctx, destination, file) {
      throw new Error('Not implemented')
    }
  }
  return {target, history, media}
}

async function applyChangesToRepo(
  owner: string,
  repo: string,
  branch: string,
  changes: Array<Change>,
  commitMessage: string,
  token: string
): Promise<string> {
  const apiUrl = 'https://api.github.com/graphql'
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const {additions, deletions} = await processChanges(
    owner,
    repo,
    branch,
    changes,
    token
  )

  const mutation = `
    mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
        }
      }
    }
  `

  const variables = {
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
      expectedHeadOid: await getLatestCommitOid(owner, repo, branch, token)
    }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({query: mutation, variables})
  })

  const result = await response.json()

  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`)
  }

  return result.data.createCommitOnBranch.commit.oid
}

async function processChanges(
  owner: string,
  repo: string,
  branch: string,
  changes: Change[],
  token: string
): Promise<{
  additions: {path: string; contents: string}[]
  deletions: {path: string}[]
}> {
  const additions: {path: string; contents: string}[] = []
  const deletions: {path: string}[] = []

  for (const change of changes) {
    switch (change.type) {
      case ChangeType.Write:
      case ChangeType.Upload:
        additions.push({
          path: change.file,
          contents:
            change.type === ChangeType.Write
              ? btoa(change.contents)
              : await fetchUploadedContent(change.url)
        })
        break
      case ChangeType.Delete:
        deletions.push({path: change.file})
        break
      case ChangeType.Rename:
        const isFolder = await isPathFolder(
          owner,
          repo,
          branch,
          change.from,
          token
        )
        if (isFolder) {
          const files = await listFilesInFolder(
            owner,
            repo,
            branch,
            change.from,
            token
          )
          for (const file of files) {
            deletions.push({path: file})
            additions.push({
              path: file.replace(change.from, change.to),
              contents: await fetchFileContent(owner, repo, branch, file, token)
            })
          }
        } else {
          deletions.push({path: change.from})
          additions.push({
            path: change.to,
            contents: await fetchFileContent(
              owner,
              repo,
              branch,
              change.from,
              token
            )
          })
        }
        break
      case ChangeType.Patch:
        const currentContent = await fetchFileContent(
          owner,
          repo,
          branch,
          change.file,
          token
        )
        const patchedContent = applyPatch(currentContent, change.patch)
        additions.push({
          path: change.file,
          contents: btoa(patchedContent)
        })
        break
    }
  }

  return {additions, deletions}
}

async function getLatestCommitOid(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<string> {
  const query = `
    query GetLatestCommit($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            oid
          }
        }
      }
    }
  `

  const variables = {owner, repo, branch}

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query, variables})
  })

  const result = await response.json()
  return result.data.repository.ref.target.oid
}

async function isPathFolder(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<boolean> {
  const query = `
    query IsPathFolder($owner: String!, $repo: String!, $expression: String!) {
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
  `

  const variables = {owner, repo, expression: `${branch}:${path}`}

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query, variables})
  })

  const result = await response.json()
  return result.data.repository.object !== null
}

async function listFilesInFolder(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<string[]> {
  const query = `
    query ListFiles($owner: String!, $repo: String!, $expression: String!) {
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
  `

  const variables = {owner, repo, expression: `${branch}:${path}`}

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query, variables})
  })

  const result = await response.json()
  return flattenFileList(result.data.repository.object.entries, path)
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
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<string> {
  const query = `
    query GetFileContent($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Blob {
            text
          }
        }
      }
    }
  `

  const variables = {owner, repo, expression: `${branch}:${path}`}

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query, variables})
  })

  const result = await response.json()
  return result.data.repository.object.text
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
