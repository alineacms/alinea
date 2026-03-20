import {Button, Menu, MenuItem, SearchField} from '@alinea/components'
import {useAtom} from 'jotai'
import {DashboardExplorer} from '../store.js'

interface BreadcrumbMenuProps {
  label: string
  items: Array<{id: string; label: string}>
}

function BreadcrumbMenu({label, items}: BreadcrumbMenuProps) {
  return (
    <Menu
      label={<Button appearance="plain">{label}</Button>}
      aria-label={label}
    >
      {items.map(item => {
        return (
          <MenuItem key={item.id} id={item.id} textValue={label}>
            {label}
          </MenuItem>
        )
      })}
    </Menu>
  )
}

interface BreadcrumbsProps {
  explorer: DashboardExplorer
}

function Breadcrumbs({explorer}: BreadcrumbsProps) {
  const [location, setLocation] = useAtom(explorer.location)
  return (
    <div>
      <BreadcrumbMenu label={location.workspace} items={[]} />
      &gt;
      <BreadcrumbMenu label={location.root} items={[]} />
    </div>
  )
}

export interface ExplorerProps {
  explorer: DashboardExplorer
}

export function Explorer({explorer}: ExplorerProps) {
  const [search, setSearch] = useAtom(explorer.search)
  return (
    <div>
      <Breadcrumbs explorer={explorer} />
      <div>
        <SearchField
          label="Search"
          placeholder="Search..."
          value={search}
          onChange={setSearch}
        />
      </div>

      <div>rows</div>
    </div>
  )
}
