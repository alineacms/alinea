import {Button, SearchField} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {
  FileTrigger,
  ToggleButton,
  ToggleButtonGroup
} from 'react-aria-components'
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
  const isMedia = useAtomValue(explorer.isMedia)
  const upload = useSetAtom(explorer.upload)
  return (
    <div>
      <ToggleButtonGroup
        selectedKeys={[view]}
        onSelectionChange={keys => {
          setView(keys.has('card') ? 'card' : 'row')
        }}
      >
        <ToggleButton id="card">
          <IcOutlineGridView /> Cards
        </ToggleButton>
        <ToggleButton id="row">
          <IcOutlineList /> Rows
        </ToggleButton>
      </ToggleButtonGroup>
      {isMedia && (
        <FileTrigger
          onSelect={files => {
            if (files) upload(files)
          }}
        >
          <Button icon={IcRoundUploadFile}>Upload media</Button>
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
        <LocationBreadcrumbs location={location} setLocation={setLocation} />
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
