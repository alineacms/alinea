import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Icon
} from '#/components.js'
import type {Config} from '#/core/Config.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {useTransition} from 'react'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardExplorer,
  ExplorerLimitLocation,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {IcRoundUnfoldMore} from '../icons.js'
import css from './ExplorerScope.module.css'

const styles = styler(css)
const all = '*'

function workspaceLabel(config: Config, workspace: string) {
  const data = config.workspaces[workspace]
  return data ? getWorkspace(data).label : workspace
}

function rootData(config: Config, {workspace, root}: ExplorerLimitLocation) {
  const data = config.workspaces[workspace]
  const value = data && getWorkspace(data).roots[root]
  return value ? getRoot(value) : undefined
}

interface ExplorerScopeOption {
  key: string
  label: string
  disabled?: boolean
}

interface ExplorerScopeMenuProps {
  label: string
  value: string
  options: Array<ExplorerScopeOption>
  onValueChange: (value: string) => void
}

function ExplorerScopeMenu({
  label,
  value,
  options,
  onValueChange
}: ExplorerScopeMenuProps) {
  const current = options.find(option => option.key === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={styles.ExplorerScope.trigger()}>
          <span className={styles.ExplorerScope.trigger.label()}>
            {current?.label}
          </span>
          <Icon
            icon={IcRoundUnfoldMore}
            className={styles.ExplorerScope.trigger.icon()}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={label} side="bottom" align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map(option => (
            <DropdownMenuRadioItem
              key={option.key}
              value={option.key}
              disabled={option.disabled}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface ExplorerScopeProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
}

/** Picks the workspace and root the explorer lists, or all of them */
export function ExplorerScope({explorer, page}: ExplorerScopeProps) {
  const config = useAtomValueRaw(configAtom)
  const locations = useAtomValueRaw(explorer.locations)
  // Wider scopes list matches, they are offered while searching or filtering
  const canWiden = useAtomValueRaw(explorer.canSearchEverything)
  const setSelectedLocale = useSetAtom(explorer.selectedLocale)
  const setScope = useSetAtom(explorer.searchScope)
  const setLocation = useSetAtom(explorer.location)
  const [, startTransition] = useTransition()
  if (explorer.pickChildren) return null
  const {location, scope} = page
  const workspaces = [...new Set(locations.map(item => item.workspace))]
  const roots = locations.filter(item => item.workspace === location.workspace)
  const wider = explorer.allowAllWorkspaces

  function widen(next: 'workspace' | 'everything') {
    startTransition(() => setScope(next))
  }

  function select(next: ExplorerLimitLocation) {
    // Narrowing back to the listed location keeps the open parent
    if (next.workspace === location.workspace && next.root === location.root)
      return startTransition(() => setScope(explorer.rootScope))
    const locales: ReadonlyArray<string> =
      rootData(config, next)?.i18n?.locales ?? []
    const locale =
      page.locale && locales.includes(page.locale)
        ? page.locale
        : (locales[0] ?? null)
    startTransition(() => {
      setScope(explorer.rootScope)
      setSelectedLocale(locale)
      setLocation({...next, locale: locale ?? undefined})
    })
  }

  return (
    <div
      aria-label="Explorer scope"
      className={styles.ExplorerScope()}
      role="group"
    >
      {workspaces.length > 1 && (
        <ExplorerScopeMenu
          label="Workspace"
          value={scope === 'everything' ? all : location.workspace}
          options={[
            ...(wider
              ? [{key: all, label: 'All workspaces', disabled: !canWiden}]
              : []),
            ...workspaces.map(key => ({
              key,
              label: workspaceLabel(config, key)
            }))
          ]}
          onValueChange={key => {
            if (key === all) return widen('everything')
            const next =
              locations.find(
                item => item.workspace === key && item.root === location.root
              ) ?? locations.find(item => item.workspace === key)
            if (next) select(next)
          }}
        />
      )}
      {scope !== 'everything' && roots.length > 1 && (
        <ExplorerScopeMenu
          label="Root"
          value={scope === 'workspace' ? all : (location.root ?? '')}
          options={[
            ...(wider
              ? [{key: all, label: 'All roots', disabled: !canWiden}]
              : []),
            ...roots.map(item => ({
              key: item.root,
              label: rootData(config, item)?.label ?? item.root
            }))
          ]}
          onValueChange={key => {
            if (key === all) return widen('workspace')
            const next = roots.find(item => item.root === key)
            if (next) select(next)
          }}
        />
      )}
    </div>
  )
}
