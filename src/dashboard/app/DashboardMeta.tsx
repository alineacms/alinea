import {btoa} from '#/core/util/Encoding.js'
import {atom, useAtomValue} from 'jotai'
import type {ComponentType} from 'react'
import {useMemo} from 'react'
import {renderToString} from 'react-dom/server'
import {keepPrevious} from '../atoms/Async.js'
import {dashboardAtoms} from '../atoms/DashboardAtoms.js'
import {AlineaLogo} from './AlineaLogo.js'
import {LogoShape} from './LogoShape.js'

export const dashboardTitleAtom = keepPrevious(
  atom(async get => {
    const route = get(dashboardAtoms.route)
    if (route.page === 'users') return 'Users'
    const workspace = get(dashboardAtoms.currentWorkspace)
    const workspaceLabel = workspace ? get(workspace.label) : 'Alinea'
    const focused = await get(dashboardAtoms.focused)
    let viewLabel = workspaceLabel
    if (focused) {
      if ('entry' in focused) viewLabel = get(focused.entry.label)
      else if ('missingEntry' in focused) viewLabel = 'Entry not found'
      else if ('missingRoot' in focused) viewLabel = 'Root not found'
      else viewLabel = get(focused.root.label)
    }
    return viewLabel === workspaceLabel
      ? workspaceLabel
      : `${workspaceLabel}: ${viewLabel}`
  })
)

export const dashboardFaviconAtom = atom(get => {
  const workspace = get(dashboardAtoms.currentWorkspace)
  if (!workspace) return {color: '#7c3aed'}
  return {
    color: get(workspace.color),
    icon: get(workspace.icon)
  }
})

function faviconHref(color: string, Icon: ComponentType): string {
  const svg = renderToString(
    <LogoShape width="36" height="36" background={color} icon={Icon} />
  )
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function DashboardMeta() {
  const title = useAtomValue(dashboardTitleAtom)
  const {color, icon} = useAtomValue(dashboardFaviconAtom)
  const href = useMemo(
    () => faviconHref(color, icon ?? AlineaLogo),
    [color, icon]
  )
  return (
    <>
      <title>{title}</title>
      <link rel="icon" type="image/svg+xml" href={href} />
    </>
  )
}
