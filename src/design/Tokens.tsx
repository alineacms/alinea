import styler from '@alinea/styler'
import type {CSSProperties, PropsWithChildren} from 'react'
import css from './Tokens.module.css'

const styles = styler(css)

const colors = [
  ['Backdrop', 'var(--alinea-backdrop)', '#f3f4f7 · #101828'],
  ['Background', 'var(--alinea-bg)', '#ffffff · #1e2939'],
  ['Background muted', 'var(--alinea-bg-muted)', '#f9fafb · #101828'],
  ['Foreground', 'var(--alinea-fg)', '#364153 · #e7e8ec'],
  ['Foreground muted', 'var(--alinea-fg-muted)', '#4a5565 · #99a1af'],
  ['Border', 'var(--alinea-border)', '#e7e8ec · #101828'],
  ['Input', 'var(--alinea-input)', '#ffffff · #101828'],
  ['Muted control', 'var(--alinea-muted)', '#f3f4f7 · #364153'],
  ['Primary', 'var(--alinea-primary)', '#4c57f6 · #747df8'],
  ['Primary subtle', 'var(--alinea-primary-subtle)', '#edeefe · 20% blue'],
  ['Danger', 'var(--alinea-danger)', '#ef5350 · #f44336'],
  ['Published', 'var(--alinea-status-published-bg)', '#5ee9b5 · #006045'],
  ['Draft', 'var(--alinea-status-draft-bg)', '#edeefe · #4c57f6'],
  ['Unpublished', 'var(--alinea-status-unpublished-bg)', '#fcf5ee · #863926'],
  ['Archived', 'var(--alinea-status-archived-bg)', '#f9fafb · #364153']
] as const

const spaces = [
  ['Space 1', 'var(--alinea-space-1)', '4px'],
  ['Space 2', 'var(--alinea-space-2)', '8px'],
  ['Space 3', 'var(--alinea-space-3)', '16px'],
  ['Space 4', 'var(--alinea-space-4)', '24px']
] as const

const radii = [
  ['Control', 'var(--alinea-radius-control)', '8px'],
  ['Round', 'var(--alinea-radius-round)', '999px']
] as const

const typography = [
  ['Small', 'var(--alinea-font-size-small)', '12px', '400'],
  ['Base', 'var(--alinea-font-size-base)', '13px', '400'],
  ['Control', 'var(--alinea-font-size-base)', '13px', '600'],
  ['Large', 'var(--alinea-font-size-large)', '14px', '600'],
  ['Title', 'var(--alinea-font-size-title)', '18px', '600']
] as const

export interface DesignTokensProps extends PropsWithChildren {
  theme: 'light' | 'dark'
}

export function DesignTokens({children, theme}: DesignTokensProps) {
  return (
    <div className={styles['alinea-Tokens']()} data-theme={theme}>
      {children}
    </div>
  )
}

interface TokenSectionProps extends PropsWithChildren {
  title: string
}

function TokenSection({children, title}: TokenSectionProps) {
  return (
    <section className={styles['alinea-Tokens-section']()}>
      <h3 className={styles['alinea-Tokens-heading']()}>{title}</h3>
      <div className={styles['alinea-Tokens-grid']()}>{children}</div>
    </section>
  )
}

function TokenMeta({name, value}: {name: string; value: string}) {
  return (
    <span className={styles['alinea-Tokens-meta']()}>
      <span className={styles['alinea-Tokens-name']()}>{name}</span>
      <code className={styles['alinea-Tokens-value']()}>{value}</code>
    </span>
  )
}

export function ColorTokens() {
  return (
    <TokenSection title="Color">
      {colors.map(([name, variable, value]) => (
        <div className={styles['alinea-Tokens-item']()} key={name}>
          <span
            className={styles['alinea-Tokens-swatch']()}
            style={{'--alinea-token-color': variable} as CSSProperties}
          />
          <TokenMeta name={name} value={value} />
        </div>
      ))}
    </TokenSection>
  )
}

export function SpacingTokens() {
  return (
    <TokenSection title="Spacing">
      {spaces.map(([name, variable, value]) => (
        <div className={styles['alinea-Tokens-item']()} key={name}>
          <span
            className={styles['alinea-Tokens-measure']()}
            style={{'--alinea-token-size': variable} as CSSProperties}
          />
          <TokenMeta name={name} value={value} />
        </div>
      ))}
    </TokenSection>
  )
}

export function RadiusTokens() {
  return (
    <TokenSection title="Radius">
      {radii.map(([name, variable, value]) => (
        <div className={styles['alinea-Tokens-item']()} key={name}>
          <span
            className={styles['alinea-Tokens-radius']()}
            style={{'--alinea-token-radius': variable} as CSSProperties}
          />
          <TokenMeta name={name} value={value} />
        </div>
      ))}
    </TokenSection>
  )
}

export function TypographyTokens() {
  return (
    <TokenSection title="Typography">
      {typography.map(([name, variable, value, weight]) => (
        <div className={styles['alinea-Tokens-item']()} key={name}>
          <p
            className={styles['alinea-Tokens-typeSample']()}
            style={
              {
                '--alinea-token-font-size': variable,
                '--alinea-token-font-weight': weight
              } as CSSProperties
            }
          >
            Aa
          </p>
          <TokenMeta name={name} value={`${value} / ${weight}`} />
        </div>
      ))}
    </TokenSection>
  )
}
