import type {RootData} from '#/core/Root.js'
import {assert} from '#/core/util/Assert.js'
import {page, routeAtom, type Page} from '#/dashboard/atoms/nav.js'
import {
  rootAtoms,
  type RootAtoms,
  type RootViewProps
} from '#/dashboard/atoms/root.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType} from 'react'
import {Explorer} from '../Explorer.js'
import {NotFoundPanel} from './EntryPage.js'
import {Rail, RailBody} from '../ui/Rail.js'
import css from './RootPage.module.css'

const styles = styler(css)

export const rootPage = page(async (page, get) => {
  assert(page.workspace, 'Workspace expected')
  assert(page.root, 'Root expected')
  const root = rootAtoms(page, page.workspace, page.root, page.locale ?? null)
  const data = get(root.data)
  const view = get(root.view)
  if (!view) await get(root.explorer.items)
  return <RootEditor data={data} root={root} view={view} />
})

interface RootEditorProps {
  root: RootAtoms
  data: RootData
  view: ComponentType<RootViewProps> | undefined
}

function RootEditor({data, root, view: View}: RootEditorProps) {
  if (View) {
    const rootData = {...data, name: root.key}
    return (
      <Rail main>
        <RailBody className={styles.RootPage.customView()}>
          <View root={rootData} />
        </RailBody>
      </Rail>
    )
  }
  return <RootBrowser root={root} />
}

interface RootBrowserProps {
  root: RootAtoms
}

function RootBrowser({root}: RootBrowserProps) {
  return (
    <Rail main>
      <Explorer explorer={root.explorer} />
    </Rail>
  )
}

export interface MissingRootProps {
  page: Page
  requestedRoot: string
  root: RootAtoms
}

export function MissingRoot({page, requestedRoot, root}: MissingRootProps) {
  const label = useAtomValue(root.label)
  const setRoute = useSetAtom(routeAtom)
  return (
    <NotFoundPanel
      title="Root not found"
      message="The requested root could not be found or is no longer available."
      requestedLabel="Requested root"
      requestedValue={requestedRoot}
      actionLabel={`Go to ${label}`}
      onAction={() =>
        setRoute({
          workspace: page.workspace,
          root: page.root,
          locale: page.locale ?? undefined
        })
      }
    />
  )
}
