import {btoa} from '#/core/util/Encoding.js'
import type {ComponentType} from 'react'
import {useMemo} from 'react'
import {renderToString} from 'react-dom/server'
import {AlineaLogo} from './AlineaLogo.js'
import {LogoShape} from './LogoShape.js'

export interface DashboardMetaProps {
  color: string
  icon?: ComponentType
  plain?: boolean
  title: string
}

function faviconHref(
  color: string,
  Icon: ComponentType,
  plain: boolean
): string {
  const svg = plain
    ? renderToString(
        <AlineaLogo
          width="36"
          height="36"
          viewBox="-4 -4 32 32"
          style={{color}}
        />
      )
    : renderToString(
        <LogoShape width="36" height="36" background={color} icon={Icon} />
      )
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function DashboardMeta({
  color,
  icon,
  plain = false,
  title
}: DashboardMetaProps) {
  const href = useMemo(
    () => faviconHref(color, icon ?? AlineaLogo, plain),
    [color, icon, plain]
  )
  return (
    <>
      <title>{title}</title>
      <link rel="icon" type="image/svg+xml" href={href} />
    </>
  )
}
