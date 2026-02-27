import {Select, SelectItem} from '@alinea/components'
import styler from '@alinea/styler'
import {Workspace} from 'alinea/core/Workspace'
import {useAtom, useAtomValue} from 'jotai'
import {useEffect, useMemo} from 'react'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {currentWorkspaceAtom} from '../atoms/cms/workspaces.js'
import {dbAtom} from '../atoms/db.js'
import {configAtom} from '../atoms/config.js'
import css from './AppShell.module.css'
import {SidebarTree} from './SidebarTree'

const styles = styler(css)

export function AppShell() {
  const db = useAtomValue(dbAtom)
  const config = useAtomValue(configAtom)
  const route = useAtomValue(cmsRouteAtom)
  const [workspace, setWorkspace] = useAtom(currentWorkspaceAtom)
  const workspaces = useMemo(() => {
    return Object.keys(config.workspaces).map(key => {
      return {id: key, label: String(Workspace.label(config.workspaces[key]))}
    })
  }, [config])

  useEffect(
    function ensureWorkspaceInPath() {
      if (route.workspace || !workspace) return
      setWorkspace(workspace)
    },
    [route.workspace, setWorkspace, workspace]
  )

  return (
    <div className={styles.root()}>
      <aside className={styles.left()}>
        <div className={styles.leftSectionHeader()}>
          <Select
            aria-label="Workspace"
            className={styles.workspaceSelect()}
            items={workspaces}
            selectedKey={workspace}
            onSelectionChange={key => {
              if (!key) return
              setWorkspace(String(key))
            }}
          >
            {item => <SelectItem id={item.id}>{item.label}</SelectItem>}
          </Select>
        </div>

        <div className={styles.treeWrap()}>
          <SidebarTree />
        </div>

        <footer className={styles.leftFooter()}>
          <div className={styles.meta()}>db.sha: {db.sha || '-'}</div>
        </footer>
      </aside>

      <main className={styles.main()}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>Main area</h1>
        </header>

        <div className={styles.mainBody()}>
          <div className={styles.form()}>
            <p className={styles.meta()}>Placeholder: selected entry summary</p>
            <p className={styles.meta()}>Placeholder: field editor surface</p>
          </div>
        </div>
      </main>
    </div>
  )
}
