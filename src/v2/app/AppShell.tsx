import styler from '@alinea/styler'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useMemo, useState} from 'react'
import {cmsRouteAtom} from '../atoms/cms/route.js'
import {applyTreeRouteStateCommand} from '../atoms/cms/tree.js'
import {currentWorkspaceAtom} from '../atoms/cms/workspaces.js'
import {dbAtom} from '../atoms/db.js'
import {configAtom} from '../atoms/config.js'
import type {EntryViews} from '../fields/FieldView.js'
import css from './AppShell.module.css'
import {ContentExplorer} from './ContentExplorer.js'
import {EntryEditor} from './EntryEditor.js'
import {LocaleMenu} from './LocaleMenu.js'
import {SidebarTree} from './SidebarTree.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'

const styles = styler(css)

interface AppShellProps {
  views: EntryViews
}

export function AppShell({views}: AppShellProps) {
  const db = useAtomValue(dbAtom)
  const config = useAtomValue(configAtom)
  const [route, setRoute] = useAtom(cmsRouteAtom)
  const [workspace, setWorkspace] = useAtom(currentWorkspaceAtom)
  const [mainTitle, setMainTitle] = useState('Entries')
  const applyTreeRouteState = useSetAtom(applyTreeRouteStateCommand)
  const workspaces = useMemo(() => {
    return Object.keys(config.workspaces).map(key => {
      const data = Workspace.data(config.workspaces[key])
      return {
        id: key,
        label: String(Workspace.label(config.workspaces[key])),
        icon: data.icon,
        color: data.color
      }
    })
  }, [config])
  const rootLocales = useMemo(() => {
    if (!route.workspace || !route.root) return []
    const workspaceConfig = config.workspaces[route.workspace]
    if (!workspaceConfig) return []
    const rootConfig = workspaceConfig[route.root]
    if (!rootConfig) return []
    return Root.data(rootConfig).i18n?.locales ?? []
  }, [config, route.root, route.workspace])
  const selectedLocale = useMemo(() => {
    if (!rootLocales.length) return undefined
    if (route.locale && rootLocales.includes(route.locale)) return route.locale
    return rootLocales[0]
  }, [rootLocales, route.locale])

  useEffect(
    function ensureWorkspaceInPath() {
      if (route.workspace || !workspace) return
      setWorkspace(workspace)
    },
    [route.workspace, setWorkspace, workspace]
  )
  useEffect(
    function keepLocaleInSyncWithRoot() {
      if (!rootLocales.length) {
        if (!route.locale) return
        setRoute(prev => ({...prev, locale: undefined}))
        return
      }
      if (!selectedLocale || route.locale === selectedLocale) return
      setRoute(prev => ({...prev, locale: selectedLocale}))
    },
    [rootLocales, route.locale, selectedLocale, setRoute]
  )
  useEffect(
    function ensureRootInPath() {
      const workspaceId = route.workspace || workspace
      if (!workspaceId || route.root) return
      const workspaceConfig = config.workspaces[workspaceId]
      if (!workspaceConfig) return
      const firstRoot = Object.keys(Workspace.roots(workspaceConfig))[0]
      if (!firstRoot) return
      setRoute(prev => ({
        ...prev,
        workspace: workspaceId,
        root: firstRoot,
        entry: undefined
      }))
    },
    [config, route.root, route.workspace, setRoute, workspace]
  )
  useEffect(
    function syncTreeStateToRoute() {
      const workspaceId = route.workspace || workspace
      if (!workspaceId) return
      void applyTreeRouteState({
        workspace: workspaceId,
        root: route.root,
        entry: route.entry
      })
    },
    [
      applyTreeRouteState,
      route.entry,
      route.root,
      route.workspace,
      workspace
    ]
  )

  return (
    <div className={styles.root()}>
      <aside className={styles.left()}>
        <div className={styles.leftSectionHeader()}>
          <WorkspaceMenu
            items={workspaces}
            selectedWorkspace={workspace}
            onSelectWorkspace={setWorkspace}
          />
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
          <h1 className={styles.mainTitle()}>{mainTitle}</h1>
          <LocaleMenu
            locales={rootLocales}
            selectedLocale={selectedLocale}
            onSelectLocale={function onSelectLocale(locale) {
              setRoute(prev => ({...prev, locale}))
            }}
          />
        </header>

        <div className={styles.mainBody()}>
          <div className={styles.explorerPane()}>
            <ContentExplorer
              graph={db}
              config={config}
              workspace={route.workspace || workspace}
              root={route.root}
              entry={route.entry}
              locale={selectedLocale}
              onScopeTitleChange={setMainTitle}
              onOpenEntry={function onOpenEntry(entryId) {
                const workspaceId = route.workspace || workspace
                const rootId = route.root
                if (!workspaceId || !rootId) return
                const nextRoute = {
                  workspace: workspaceId,
                  root: rootId,
                  entry: entryId,
                  locale: route.locale
                }
                setRoute(nextRoute)
                void applyTreeRouteState(nextRoute)
              }}
            />
          </div>
          <div className={styles.editorPane()}>
            <EntryEditor
              graph={db}
              config={config}
              views={views}
              workspace={route.workspace || workspace}
              root={route.root}
              entry={route.entry}
              locale={selectedLocale}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
