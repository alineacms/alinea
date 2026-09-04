import type {AccessClassId} from '../replica/Types.js'
export function readAccessClass(entryVersionId: string): AccessClassId {
  return `entry-read:${entryVersionId}`
}
