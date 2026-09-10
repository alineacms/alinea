import {HttpError} from '../HttpError.js'
import {isRecord} from '../util/Objects.js'

/** The authenticated browser view against which a pending intent was authored. */
export interface MutationContext {
  project: string
  namespace: string
  epoch: string
  principal: string
  schemaId: string
  configId: string
  baseRevision: string
}

const keys = [
  'project',
  'namespace',
  'epoch',
  'principal',
  'schemaId',
  'configId',
  'baseRevision'
] as const

export function decodeMutationContext(
  header: string | null
): MutationContext | undefined {
  if (header === null) return
  if (header.length > 8192)
    throw new HttpError(400, 'Mutation context exceeds byte limit')
  let value: unknown
  try {
    value = JSON.parse(decodeURIComponent(header))
  } catch {
    throw new HttpError(400, 'Invalid mutation context')
  }
  if (
    !isRecord(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every(
      key =>
        typeof value[key] === 'string' &&
        value[key].length > 0 &&
        value[key].length <= 1024
    )
  )
    throw new HttpError(400, 'Invalid mutation context')
  return {
    project: value.project as string,
    namespace: value.namespace as string,
    epoch: value.epoch as string,
    principal: value.principal as string,
    schemaId: value.schemaId as string,
    configId: value.configId as string,
    baseRevision: value.baseRevision as string
  }
}
