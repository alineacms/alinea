import {HStack, px, Typo} from '@alinea/ui'
import {PropsWithChildren, useMemo} from 'react'
import {packageName, types} from '../data/Types'
import {TypePageProps} from '../pages/types/[...path]'
import {Container} from './layout/Container'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
import {NavItem, NavTree} from './layout/NavTree'
import {Declaration, ReflectionKind} from './types/Declaration'

function buildNav(): Array<NavItem> {
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

const nav = buildNav()

function Type({children}: PropsWithChildren<{}>) {
  return (
    <div
      style={{
        paddingTop: px(20),
        paddingBottom: px(20),
        fontFamily: `'JetBrains Mono', monospace`,
        borderBottom: `1px solid rgb(217 219 221)`,
        fontSize: px(14)
      }}
    >
      {children}
    </div>
  )
}

const isVirtual = ReflectionKind.TypeAlias | ReflectionKind.Interface

export function TypePage(props: TypePageProps) {
  const path = props.selected as string
  const name = packageName(path)
  const members = useMemo(
    () =>
      types
        .children!.filter(child => {
          return child.name.startsWith(path)
        })
        .flatMap(child => child.children!)
        .sort((a, b) => {
          /*const aIsVirtual = a.kind & isVirtual
          const bIsVirtual = b.kind & isVirtual
          if (aIsVirtual && !bIsVirtual) return -1
          if (!aIsVirtual && bIsVirtual) return 1*/
          return a.name.localeCompare(b.name)
        }),
    [path]
  )
  if (!members.length) return null
  return (
    <Layout {...props.layout}>
      <Container>
        <HStack gap={80}>
          <NavSidebar>
            <NavTree nav={nav} />
          </NavSidebar>
          <div style={{flexGrow: 1, minWidth: 0}}>
            <Typo.H1>{name}</Typo.H1>
            <Declaration members={members} wrap={Type} />
          </div>
        </HStack>
      </Container>
    </Layout>
  )
}
