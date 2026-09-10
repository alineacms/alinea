import {Permission, type Policy, type Resource} from '../Role.js'
import {isRecord} from '../util/Objects.js'

export interface MutationPermission {
  permission: Permission
  resource?: Resource
}

const resourceKeys = [
  'workspace',
  'root',
  'type',
  'field',
  'id',
  'locale',
  'parents'
] as const

/** Record the actual checks performed by preparation, never entry payloads. */
export class MutationAuthorization {
  #policy: Policy
  #checks = new Map<string, MutationPermission>()

  constructor(policy: Policy) {
    this.#policy = policy
  }

  assert(permission: Permission, resource?: Resource): void {
    this.#policy.assert(permission, resource)
    const check: MutationPermission = {permission}
    if (resource) {
      check.resource = {}
      for (const key of resourceKeys) {
        const value = resource[key]
        if (value !== undefined) Object.assign(check.resource, {[key]: value})
      }
    }
    const detached = structuredClone(check)
    this.#checks.set(JSON.stringify(detached), detached)
  }

  snapshot(): Array<MutationPermission> {
    return structuredClone([...this.#checks.values()])
  }
}

/** Receipts are source data, not executable policies or client-supplied grants. */
export function decodeMutationPermissions(
  value: unknown
): Array<MutationPermission> {
  if (!Array.isArray(value) || value.length > 65536)
    throw new Error('Invalid mutation permissions')
  return Array.from(value, check => {
    if (
      !isRecord(check) ||
      !Number.isInteger(check.permission) ||
      typeof check.permission !== 'number' ||
      check.permission <= 0 ||
      (check.permission & Permission.All) !== check.permission
    )
      throw new Error('Invalid mutation permission')
    const result: MutationPermission = {permission: check.permission}
    if (check.resource !== undefined) {
      if (
        !isRecord(check.resource) ||
        Object.keys(check.resource).some(
          key => !resourceKeys.includes(key as (typeof resourceKeys)[number])
        )
      )
        throw new Error('Invalid mutation resource')
      const resource: Resource = {}
      for (const key of resourceKeys) {
        const value = check.resource[key]
        if (value === undefined) continue
        if (key === 'parents') {
          if (
            !Array.isArray(value) ||
            value.length > 4096 ||
            !Array.from(value).every(validName)
          )
            throw new Error('Invalid mutation ancestors')
          resource.parents = [...value]
        } else {
          if (!(key === 'locale' && value === null) && !validName(value))
            throw new Error('Invalid mutation resource')
          Object.assign(resource, {[key]: value})
        }
      }
      result.resource = resource
    }
    return result
  })
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
}

/** The caller evaluates a fresh trusted policy before checking a saved receipt. */
export function authorizeMutationReceipt(
  policy: Policy,
  permissions: unknown
): void {
  for (const check of decodeMutationPermissions(permissions))
    policy.assert(check.permission, check.resource)
}
