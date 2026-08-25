import type {AccessClassGrant, AccessClassId} from './Types.js'
import {RoleMask, RoleTable} from './RoleMask.js'

export interface FrameAccessClass {
  id: AccessClassId
  allow: RoleMask
  deny: RoleMask
  key: Uint8Array
}

export interface FrameAccessClassInput {
  id: AccessClassId
  allow: Iterable<string>
  deny?: Iterable<string>
  key: Uint8Array
}

export function createFrameAccessClass(
  roles: RoleTable,
  input: FrameAccessClassInput
): FrameAccessClass {
  return {
    id: input.id,
    allow: roles.mask(input.allow),
    deny: roles.mask(input.deny ?? []),
    key: input.key.slice()
  }
}

export function canAccessFrameClass(
  userRoles: RoleMask,
  access: FrameAccessClass
): boolean {
  return (
    userRoles.intersects(access.allow) && !userRoles.intersects(access.deny)
  )
}

export function createAccessGrants(
  userRoles: RoleMask,
  classes: Iterable<FrameAccessClass>
): Array<AccessClassGrant> {
  const grants: Array<AccessClassGrant> = []
  for (const access of classes) {
    if (!canAccessFrameClass(userRoles, access)) continue
    grants.push({accessClassId: access.id, key: access.key.slice()})
  }
  return grants
}
