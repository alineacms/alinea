import {JSONOutput} from 'typedoc'
import type {NavItem} from '../view/layout/NavTree'
import {types} from './types-data'

export function memberPath(name: string) {
  return name
    .split('/')
    .filter(segment => segment !== 'dist')
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
        const pkg = child.name.split('/dist')[0]
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

export function typeInfo(types: Array<string>) {
  return types.flatMap(name => findDeclaration(name))
}
