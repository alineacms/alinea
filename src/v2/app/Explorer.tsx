import {Button, Menu, MenuItem, SearchField} from '@alinea/components'
import styler from '@alinea/styler'
import {Atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {IcOutlineGridView, IcOutlineList} from '../icons.js'
import {DashboardExplorer, DashboardMenuItem} from '../store.js'
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'

const styles = styler(css)

interface BreadcrumbMenuProps {
  label: Atom<string>
  items: Atom<Array<DashboardMenuItem>>
  onAction: (id: string) => void
}

function BreadcrumbMenu(props: BreadcrumbMenuProps) {
  const label = useAtomValue(props.label)
  const items = useAtomValue(props.items)
  const onAction = props.onAction
  return (
    <Menu
      label={<Button appearance="plain">{label}</Button>}
      aria-label={label}
      onAction={key => onAction(String(key))}
    >
      {items.map(item => {
        return (
          <MenuItem key={item.id} id={item.id} textValue={item.label}>
            {item.label}
          </MenuItem>
        )
      })}
    </Menu>
  )
}

interface BreadcrumbsProps {
  explorer: DashboardExplorer
}

interface ParentBreadcrumbsProps {
  explorer: DashboardExplorer
}

function ParentBreadcrumbs({explorer}: ParentBreadcrumbsProps) {
  const parents = useAtomValue(explorer.parentsMenu)
  const setParent = useSetAtom(explorer.parent)
  return parents.map(parent => {
    return (
      <span key={parent.id}>
        {' > '}
        <Button appearance="plain" onPress={() => setParent(parent.id)}>
          {parent.label}
        </Button>
      </span>
    )
  })
}

function Breadcrumbs({explorer}: BreadcrumbsProps) {
  const [workspace, setWorkspace] = useAtom(explorer.workspace)
  const [root, setRoot] = useAtom(explorer.root)
  return (
    <div>
      <BreadcrumbMenu
        label={workspace.label}
        items={explorer.dashboard.workspaceMenu}
        onAction={setWorkspace}
      />
      &gt;
      {root && (
        <BreadcrumbMenu
          label={root.label}
          items={workspace.rootMenu}
          onAction={setRoot}
        />
      )}
      <ParentBreadcrumbs explorer={explorer} />
    </div>
  )
}

export interface ExplorerProps {
  explorer: DashboardExplorer
}

interface ExplorerSearchProps {
  explorer: DashboardExplorer
}

function ExplorerSearch({explorer}: ExplorerSearchProps) {
  const [search, setSearch] = useAtom(explorer.search)
  return (
    <SearchField
      label="Search"
      placeholder="Search..."
      value={search}
      onChange={setSearch}
    />
  )
}

interface ExplorerToolbarProps {
  explorer: DashboardExplorer
}

function ExplorerToolbar({explorer}: ExplorerToolbarProps) {
  const [view, setView] = useAtom(explorer.view)
  return (
    <div>
      <Button
        appearance={view === 'card' ? 'active' : 'plain'}
        onPress={() => setView('card')}
      >
        <IcOutlineGridView /> Cards
      </Button>
      <Button
        appearance={view === 'row' ? 'active' : 'plain'}
        onPress={() => setView('row')}
      >
        <IcOutlineList /> Rows
      </Button>
    </div>
  )
}

export function Explorer({explorer}: ExplorerProps) {
  return (
    <div className={styles.root()}>
      <Breadcrumbs explorer={explorer} />
      <div className={styles.toolbar()}>
        <ExplorerSearch explorer={explorer} />
        <ExplorerToolbar explorer={explorer} />
      </div>

      <div className={styles.listViewport()}>
        <ExplorerList explorer={explorer} />
      </div>
    </div>
  )
}
