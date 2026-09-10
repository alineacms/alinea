import {HttpError} from '#/core/HttpError.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {GithubSourceOptions} from '#/core/source/GithubSource.js'
import {sha256Hash} from '#/core/source/Utils.js'
import {isRecord} from '#/core/util/Objects.js'
import {join} from '#/core/util/Paths.js'

export interface GitReceipt {
  path: string
  contents: string
  digest: string
}

/** Kept outside the indexed content subtree; published atomically with its edit. */
export async function gitReceipt(
  options: GithubSourceOptions,
  request: CommitRequest
): Promise<GitReceipt | undefined> {
  const transaction = request.transaction
  if (!transaction) return
  const {id, namespace, epoch, digest} = transaction
  const principal = request.user?.sub
  if (
    ![id, namespace, epoch, principal].every(
      value =>
        typeof value === 'string' && value.length > 0 && value.length <= 4096
    ) ||
    typeof digest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(digest) ||
    typeof request.intoSha !== 'string' ||
    !request.intoSha
  )
    throw new HttpError(400, 'Invalid commit transaction')
  const content = join(options.rootDir, options.contentDir)
  if (
    content === '.' ||
    content === '.alinea' ||
    content.startsWith('.alinea/')
  )
    throw new HttpError(400, 'Git receipts require content outside .alinea')
  const key = await sha256Hash(
    new TextEncoder().encode(
      JSON.stringify([
        'alinea.git-receipt.v1',
        options.owner,
        options.repo,
        options.branch,
        options.rootDir,
        options.contentDir,
        namespace,
        epoch,
        principal,
        id
      ])
    )
  )
  return {
    path: `.alinea/receipts/${key.slice(0, 2)}/${key}.json`,
    contents: JSON.stringify({version: 1, digest, sha: request.intoSha}),
    digest
  }
}

export function readGitReceipt(
  text: string,
  expected: GitReceipt
): {sha: string} {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new HttpError(409, 'Invalid durable Git receipt')
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.sha !== 'string' ||
    !value.sha
  )
    throw new HttpError(409, 'Invalid durable Git receipt')
  if (value.digest !== expected.digest)
    throw new HttpError(
      409,
      'Transaction ID was already used for another request'
    )
  return {sha: value.sha}
}
