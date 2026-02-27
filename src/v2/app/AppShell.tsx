import {
  SearchField,
  Select,
  SelectItem,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Tree,
  TreeItem
} from '@alinea/components'
import styler from '@alinea/styler'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {useSelectedEntry} from '../features/entry/useSelectedEntry'
import {
  type DashboardTreeNode,
  useDashboardTree
} from '../features/tree/useDashboardTree'
import {useApp} from '../hooks'
import css from './AppShell.module.css'

const styles = styler(css)

export function AppShell() {
  const {config, route, navigate, isNavigating} = useApp()
  const workspace = config.workspaces[route.workspace]
  const workspaceData = Workspace.data(workspace)
  const roots = workspaceData.roots
  const workspaceNames = Object.keys(config.workspaces)

  return (
    <div className={styles.root()}>
      <Body
        roots={roots}
        workspaceNames={workspaceNames}
        workspaceLabel={workspaceData.label}
        workspaceName={route.workspace}
        rootName={route.root}
        entryId={route.entryId}
        navigate={navigate}
        isNavigating={isNavigating}
      />
    </div>
  )
}

interface BodyProps {
  roots: ReturnType<typeof Workspace.data>['roots']
  workspaceNames: Array<string>
  workspaceLabel: string
  workspaceName: string
  rootName: string
  entryId?: string
  navigate: ReturnType<typeof useApp>['navigate']
  isNavigating: boolean
}

function Body({
  roots,
  workspaceNames,
  workspaceLabel,
  workspaceName,
  rootName,
  entryId,
  navigate,
  isNavigating
}: BodyProps) {
  const route = {workspace: workspaceName, root: rootName, entryId}
  const tree = useDashboardTree(route, navigate)
  const selectedEntry = useSelectedEntry(workspaceName, rootName, entryId)

  return (
    <>
      <aside className={styles.left()}>
        <header className={styles.leftHeader()}>
          <div className={styles.rowGrow()}>
            <Select
              aria-label="Workspace"
              selectedKey={workspaceName}
              onSelectionChange={key => {
                if (typeof key !== 'string') return
                navigate({workspace: key, root: rootName})
              }}
            >
              {workspaceNames.map(name => (
                <SelectItem key={name} id={name}>
                  {name}
                </SelectItem>
              ))}
            </Select>
          </div>
        </header>

        <div className={styles.leftSectionHeader()}>
          <div className={styles.rowGrow()}>
            <SearchField
              aria-label="Search entries"
              placeholder="Search entries"
              hasIcon
            />
          </div>
        </div>

        <div className={styles.treeWrap()}>
          <Tree
            aria-label="Roots and entries"
            className={styles.tree()}
            selectionMode="single"
            selectionBehavior="replace"
            selectedKeys={tree.selectedKeys}
            expandedKeys={tree.expandedKeys}
            onSelectionChange={tree.onSelectionChange}
            onExpandedChange={tree.onExpandedChange}
          >
            {tree.items.map(renderTreeNode)}
          </Tree>
        </div>

        <footer className={styles.leftFooter()}>
          <div className={styles.meta()}>{workspaceLabel}</div>
          <div className={styles.meta()}>{tree.isLoadingTree ? 'Loading tree...' : 'Tree ready'}</div>
        </footer>
      </aside>

      <main className={styles.main()}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>
            {selectedEntry.value?.title || Root.data(roots[rootName]).label}
          </h1>
          <div className={styles.mainHeaderActions()}>
            <span className={styles.statusBadge()}>
              {selectedEntry.value?.status || 'root'}
            </span>
          </div>
        </header>

        <div className={styles.mainBody()}>
          {selectedEntry.loading ? (
            <div className={styles.form()}>
              <p className={styles.meta()}>Loading entry...</p>
            </div>
          ) : selectedEntry.error ? (
            <div className={styles.form()}>
              <p className={styles.meta()}>{selectedEntry.error}</p>
            </div>
          ) : selectedEntry.value ? (
            <div className={styles.tabs()}>
              <Tabs variant="subtle">
                <TabList>
                  <Tab id="document">Document</Tab>
                  <Tab id="metadata">Metadata</Tab>
                  <Tab id="json">JSON</Tab>
                </TabList>

                <TabPanel id="document" className={styles.tabPanel()}>
                  <div className={styles.form()}>
                    <div className={styles.twoCol()}>
                      <TextField label="Title" defaultValue={selectedEntry.value.title || ''} isReadOnly />
                      <TextField label="Path" defaultValue={selectedEntry.value.path || ''} isReadOnly />
                    </div>
                    <div className={styles.twoCol()}>
                      <TextField label="Type" defaultValue={selectedEntry.value.type || ''} isReadOnly />
                      <TextField label="Locale" defaultValue={selectedEntry.value.locale || ''} isReadOnly />
                    </div>
                    <TextField label="Url" defaultValue={selectedEntry.value.url || ''} isReadOnly />
                  </div>
                </TabPanel>

                <TabPanel id="metadata" className={styles.tabPanel()}>
                  <div className={styles.form()}>
                    <TextField label="File path" defaultValue={selectedEntry.value.filePath || ''} isReadOnly />
                    <TextField label="File hash" defaultValue={selectedEntry.value.fileHash || ''} isReadOnly />
                    <TextField label="Row hash" defaultValue={selectedEntry.value.rowHash || ''} isReadOnly />
                    <TextField label="Parent id" defaultValue={selectedEntry.value.parentId || ''} isReadOnly />
                  </div>
                </TabPanel>

                <TabPanel id="json" className={styles.tabPanel()}>
                  <TextField
                    label="Entry data"
                    multiline
                    rows={18}
                    defaultValue={JSON.stringify(selectedEntry.value.data ?? {}, null, 2)}
                    isReadOnly
                  />
                </TabPanel>
              </Tabs>
            </div>
          ) : (
            <div className={styles.form()}>
              <p className={styles.meta()}>
                Select an entry in the tree to inspect real document data.
              </p>
            </div>
          )}
        </div>
      </main>

      <aside className={styles.right()}>
        <header className={styles.rightHeader()}>
          <strong>Selection</strong>
          <span className={styles.meta()}>{isNavigating ? 'Navigating' : 'Ready'}</span>
        </header>
        <ul className={styles.history()}>
          <li className={styles.historyItem()}>
            <div className={styles.historyTitle()}>Workspace</div>
            <div className={styles.meta()}>{workspaceName}</div>
          </li>
          <li className={styles.historyItem()}>
            <div className={styles.historyTitle()}>Root</div>
            <div className={styles.meta()}>{rootName}</div>
          </li>
          <li className={styles.historyItem()}>
            <div className={styles.historyTitle()}>Entry id</div>
            <div className={styles.meta()}>{entryId || 'none'}</div>
          </li>
        </ul>
      </aside>
    </>
  )
}

function renderTreeNode(node: DashboardTreeNode) {
  return (
    <TreeItem
      key={node.id}
      id={node.id}
      title={node.title}
      hasChildItems={node.hasChildItems}
    >
      {node.children?.map(child => renderTreeNode(child))}
    </TreeItem>
  )
}
