import {hashObject} from 'alinea/core/source/GitUtils'

const encoder = new TextEncoder()

export interface GitSignature {
  name: string
  email: string
}

export interface CommitObjectInput {
  tree: string
  parent: string
  message: string
  author: GitSignature
  committer?: GitSignature
  date?: Date
}

export function serializeCommitObject(input: CommitObjectInput): Uint8Array {
  const date = input.date ?? new Date()
  const signature = formatSignature(input.author, date)
  const committer = formatSignature(
    input.committer ?? input.author,
    date
  )
  const body = [
    `tree ${input.tree}`,
    `parent ${input.parent}`,
    `author ${signature}`,
    `committer ${committer}`,
    '',
    input.message
  ].join('\n')
  return encoder.encode(body)
}

export function hashCommitObject(input: CommitObjectInput): Promise<string> {
  return hashObject('commit', serializeCommitObject(input))
}

function formatSignature(signature: GitSignature, date: Date) {
  const seconds = Math.floor(date.getTime() / 1000)
  return `${signature.name} <${signature.email}> ${seconds} +0000`
}
