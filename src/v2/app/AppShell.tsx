import {Button} from '@alinea/components'
import styler from '@alinea/styler'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {Suspense, useMemo} from 'react'
import {useEntries} from '../features/entries/useEntries'
import {useApp} from '../hooks'
import type {RouteState} from '../routing/state'
import css from './AppShell.module.css'

console.log(css)

const styles = styler(css)

function nextRoute(base: RouteState, patch: Partial<RouteState>): RouteState {
  const merged = {...base, ...patch}
  if (!patch.entryId && patch.entryId !== undefined) delete merged.entryId
  return merged
}

function navButtonClass(active: boolean): string {
  return active
    ? `${styles.navButton()} ${styles.navButtonActive()}`
    : styles.navButton()
}

export function AppShell() {
  const {config, route, navigate, isNavigating} = useApp()
  const workspace = config.workspaces[route.workspace]
  const workspaceData = Workspace.data(workspace)
  const roots = workspaceData.roots
  const rootData = Root.data(roots[route.root])

  return (
    <div className={styles.root()}>
      <header className={styles.header()}>
        <div className={styles.brand()}>
          <span>Dashboard v2</span>
          <span className={styles.badge()}>
            {workspaceData.label} / {rootData.label}
          </span>
        </div>
        <div className={styles.meta()}>
          {isNavigating ? 'Navigating...' : 'Ready'}
        </div>
      </header>

      <Suspense fallback={<LoadingBody roots={roots} rootData={rootData} />}>
        <Body
          roots={roots}
          rootData={rootData}
          route={route}
          navigate={navigate}
        />
      </Suspense>
    </div>
  )
}

interface BodyProps {
  roots: ReturnType<typeof Workspace.data>['roots']
  rootData: ReturnType<typeof Root.data>
  route: RouteState
  navigate: (next: RouteState, replace?: boolean) => void
}

function Body({roots, rootData, route, navigate}: BodyProps) {
  const entries = useEntries(route.workspace, route.root)
  const selectedEntry = useMemo(
    () => entries.find(entry => entry.id === route.entryId),
    [entries, route.entryId]
  )
  return (
    <div className={styles.body()}>
      <aside className={styles.sidebar()}>
        <section className={styles.section()}>
          <h2 className={styles.sectionTitle()}>Roots</h2>
          <ul className={styles.list()}>
            {Object.keys(roots).map(rootName => {
              const isActive = route.root === rootName && !route.entryId
              return (
                <li key={rootName}>
                  <button
                    type="button"
                    className={navButtonClass(isActive)}
                    onClick={() =>
                      navigate(
                        nextRoute(route, {
                          workspace: route.workspace,
                          root: rootName,
                          entryId: undefined
                        })
                      )
                    }
                  >
                    {Root.data(roots[rootName]).label}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className={styles.section()}>
          <h2 className={styles.sectionTitle()}>Entries</h2>
          <ul className={styles.list()}>
            {entries.slice(0, 25).map(entry => {
              const isActive = route.entryId === entry.id
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={navButtonClass(isActive)}
                    onClick={() =>
                      navigate(
                        nextRoute(route, {
                          entryId: entry.id,
                          root: route.root,
                          workspace: route.workspace
                        })
                      )
                    }
                  >
                    {entry.title || entry.id}
                  </button>
                </li>
              )
            })}
            {entries.length === 0 && (
              <li className={styles.meta()}>
                No entries found for this root yet.
              </li>
            )}
          </ul>
        </section>
      </aside>

      <main className={styles.main()}>
        <section className={styles.panel()}>
          {!route.entryId ? (
            <>
              <h1 className={styles.panelTitle()}>{rootData.label}</h1>
              <p className={styles.meta()}>
                Select an entry from the left to start editing.
              </p>
              <p className={styles.meta()}>
                This is the first v2 shell with hook-based state and transition
                navigation.
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.panelTitle()}>
                {selectedEntry?.title || route.entryId}
              </h1>
              <p className={styles.meta()}>Entry ID: {route.entryId}</p>
              <p className={styles.meta()}>
                Type: {selectedEntry?.type || 'Unknown'}
              </p>
              <p className={styles.meta()}>
                Status: {selectedEntry?.status || 'Unknown'}
              </p>
              <div style={{marginTop: 12}}>
                <Button
                  onPress={() =>
                    navigate(nextRoute(route, {entryId: undefined}))
                  }
                >
                  Back to root overview
                </Button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

interface LoadingBodyProps {
  roots: ReturnType<typeof Workspace.data>['roots']
  rootData: ReturnType<typeof Root.data>
}

function LoadingBody({roots, rootData}: LoadingBodyProps) {
  return (
    <div className={styles.body()}>
      <aside className={styles.sidebar()}>
        <section className={styles.section()}>
          <h2 className={styles.sectionTitle()}>Roots</h2>
          <ul className={styles.list()}>
            {Object.keys(roots).map(rootName => (
              <li key={rootName}>
                <div className={styles.navButton()}>
                  {Root.data(roots[rootName]).label}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.section()}>
          <h2 className={styles.sectionTitle()}>Entries</h2>
          <div className={styles.meta()}>Loading entries...</div>
        </section>
      </aside>

      <main className={styles.main()}>
        <section className={styles.panel()}>
          <h1 className={styles.panelTitle()}>{rootData.label}</h1>
          <p className={styles.meta()}>Loading content...</p>
        </section>
      </main>
    </div>
  )
}
