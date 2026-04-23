import {
  Button,
  SearchField,
  ToggleButton,
  ToggleButtonGroup
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {FileTrigger} from 'react-aria-components'
import {IcOutlineGridView, IcOutlineList, IcRoundUploadFile} from '../icons.js'
import {DashboardExplorer} from '../store.js'
import css from './Explorer.module.css'
import {ExplorerList} from './ExplorerList.js'
import {LocationBreadcrumbs} from './LocationBreadcrumbs.js'
import {RailBody, RailHeader} from './ui/Rail.js'

const styles = styler(css)

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
      aria-label="Search"
      className={styles.Explorer.search()}
      hasIcon
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
  const isMedia = useAtomValue(explorer.isMedia)
  const upload = useSetAtom(explorer.upload)
  return (
    <div className={styles.Explorer.actions()}>
      <ToggleButtonGroup
        aria-label="Explorer view"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[view]}
        onSelectionChange={keys => {
          setView(keys.has('card') ? 'card' : 'row')
        }}
      >
        <ToggleButton id="card">
          <IcOutlineGridView data-slot="icon" /> Cards
        </ToggleButton>
        <ToggleButton id="row">
          <IcOutlineList data-slot="icon" /> Rows
        </ToggleButton>
      </ToggleButtonGroup>
      {isMedia && (
        <FileTrigger
          onSelect={files => {
            if (files) upload(files)
          }}
        >
          <Button icon={IcRoundUploadFile} intent="primary">
            Upload media
          </Button>
        </FileTrigger>
      )}
    </div>
  )
}

export function Explorer({explorer}: ExplorerProps) {
  const [location, setLocation] = useAtom(explorer.location)
  return (
    <>
      <RailHeader>
        <div className={styles.Explorer.breadcrumbs()}>
          <LocationBreadcrumbs
            location={location}
            setLocation={setLocation}
            enableRoot
          />
        </div>
        <div className={styles.Explorer.toolbar()}>
          <ExplorerSearch explorer={explorer} />
          <ExplorerToolbar explorer={explorer} />
        </div>
      </RailHeader>
      <RailBody>
        <div className={styles.Explorer.viewport()}>
          <ExplorerList explorer={explorer} />
        </div>
      </RailBody>
    </>
  )
}
