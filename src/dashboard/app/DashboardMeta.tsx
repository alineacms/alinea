import {btoa} from '#/core/util/Encoding.js'
import type {ComponentType} from 'react'
import {useMemo} from 'react'
import {renderToString} from 'react-dom/server'
import {AlineaLogo} from './AlineaLogo.js'
import {LogoShape} from './LogoShape.js'

export interface DashboardMetaProps {
  color: string
  icon?: ComponentType
  title: string
}

function faviconHref(color: string, Icon: ComponentType): string {
  const svg = renderToString(
    <LogoShape width="36" height="36" background={color} icon={Icon} />
  )
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function DashboardMeta({color, icon, title}: DashboardMetaProps) {
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
