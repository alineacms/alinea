import type {CSSProperties, ReactNode} from 'react'
import {
  IcRoundArchive,
  IcRoundRefresh,
  IcRoundSearch
} from '#/dashboard/icons.js'
import {Button, type ButtonProps} from './Button.js'

const variants: Array<NonNullable<ButtonProps['variant']>> = [
  'solid',
  'outline',
  'ghost'
]
const colors: Array<NonNullable<ButtonProps['color']>> = [
  'neutral',
  'primary',
  'secondary',
  'destructive',
  'warning'
]
const sizes: Array<NonNullable<ButtonProps['size']>> = ['sm', 'default', 'lg']
const iconSizes: Array<NonNullable<ButtonProps['size']>> = [
  'icon-sm',
  'icon',
  'icon-lg'
]

const row: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12
}

function Rows({children}: {children: ReactNode}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {children}
    </div>
  )
}

export function Variants() {
  return (
    <Rows>
      {variants.map(variant => (
        <div key={variant} style={row}>
          {colors.map(color => (
            <Button key={color} variant={variant} color={color}>
              {color}
            </Button>
          ))}
          <Button variant={variant} disabled>
            disabled
          </Button>
          <Button variant={variant} active>
            active
          </Button>
        </div>
      ))}
    </Rows>
  )
}

export function Sizes() {
  return (
    <Rows>
      <div style={row}>
        {sizes.map(size => (
          <Button key={size} size={size} icon={IcRoundSearch}>
            Size {size}
          </Button>
        ))}
      </div>
      {variants.map(variant => (
        <div key={variant} style={row}>
          {iconSizes.map(size => (
            <Button
              key={size}
              variant={variant}
              size={size}
              icon={IcRoundRefresh}
              aria-label={`Refresh (${size})`}
            />
          ))}
        </div>
      ))}
    </Rows>
  )
}

export function Loading() {
  return (
    <div style={row}>
      <Button color="primary" loading>
        Publishing
      </Button>
      <Button variant="outline" loading>
        Saving
      </Button>
    </div>
  )
}

export function AsChild() {
  return (
    <div style={row}>
      <Button asChild variant="outline" icon={IcRoundArchive}>
        <a href="#archive">Link styled as a button</a>
      </Button>
    </div>
  )
}

export default {
  title: 'Pure components / Button'
}
