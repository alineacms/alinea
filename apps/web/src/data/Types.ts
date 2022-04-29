import {JSONOutput, ReflectionKind} from 'typedoc'
import type {NavItem} from '../view/layout/NavTree'
import {types} from './types-data'

export function memberPath(name: string) {
  return name
    .split('/')
    .filter(segment => segment !== 'src')
    .join('/')
}

export function packageName(path: string) {
  return path === 'alinea' ? 'alinea' : `@alinea/${path.split('/').join('.')}`
}

export function packagePaths() {
  return types.children!.map(child => {
    return memberPath(child.name)
  })
}

export function typeNav(): Array<NavItem> {
  const packages = Array.from(
    new Set(
      types.children!.map(child => {
        const pkg = child.name.split('/src')[0]
        return pkg
      })
    )
  )
  return [
    {
      id: 'types',
      url: '/types/alinea',
      title: 'Packages',
      children: packages.map(pkg => {
        const pkgName =
          pkg === 'alinea' ? 'alinea' : `@alinea/${pkg.split('/').join('.')}`
        return {
          id: pkg,
          url: `/types/${pkg}`,
          title: pkgName
        }
      })
    }
  ]
}

export function membersOf(packagePath: string) {
  return types
    .children!.filter(child => {
      return (
        child.name.startsWith(packagePath + '/') || child.name === packagePath
      )
    })
    .flatMap(child => child.children!)
    .map(transformType)
    .sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
}

function findDeclaration(
  name: string,
  depth = 0,
  target = types.children!
): Array<JSONOutput.DeclarationReflection> {
  const members = target.filter(child => {
    return child.name === name
  })
  if (members.length > 0) return members
  if (depth > 2) return []
  for (const member of target) {
    if (!member.children) continue
    const res = findDeclaration(name, depth + 1, member.children)
    if (res.length > 0) return res
  }
  return []
}

function fillReferences(
  index: Map<number, JSONOutput.DeclarationReflection>,
  ofMember?: JSONOutput.DeclarationReflection
) {
  const children = ofMember ? ofMember.children : types.children
  if (!children) return
  for (const member of children) {
    index.set(member.id, member)
    fillReferences(index, member)
  }
}

function references() {
  const index = new Map()
  fillReferences(index)
  return index
}

const index = references()

function transformType(
  type: JSONOutput.DeclarationReflection
): JSONOutput.DeclarationReflection {
  switch (type.kind) {
    case ReflectionKind.Reference:
      const ref = (type as any).target
      const target = index.get(ref)
      return target ? transformType(target) : type
    default:
      if (!type.children) return type
      return {
        ...type,
        children: type.children.map(transformType)
      }
  }
}

export function typeInfo(types: Array<string>) {
  return types.flatMap(name => findDeclaration(name)).map(transformType)
}
