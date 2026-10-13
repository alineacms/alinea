import styler from '@alinea/styler'
import type {CSSProperties} from 'react'
import css from './LabSha.module.scss'

const styles = styler(css)

/** Content shas get a hue of their own: the same color is the same content. */
export function shaColor(sha: string) {
  const hue = Number.parseInt(sha.slice(0, 6), 16) % 360
  return `hsl(${hue} 62% 50%)`
}

export interface LabShaProps {
  sha?: string
  /** The head of the branch, to mark content that is not at it */
  head?: string
  title?: string
  /** Mark content behind with the ring only */
  compact?: boolean
}

export function LabSha({sha, head, title, compact}: LabShaProps) {
  if (!sha) return <span className={styles.LabSha('empty')}>—</span>
  const behind = head !== undefined && head !== sha
  const style = {'--LabSha-color': shaColor(sha)} as CSSProperties
  return (
    <span
      className={styles.LabSha({behind})}
      style={style}
      title={`${title ? `${title}: ` : ''}${sha}${
        behind ? ', not the head of the branch' : ''
      }`}
    >
      <span className={styles.LabSha.dot()} />
      {sha.slice(0, 7)}
      {behind && !compact && (
        <span className={styles.LabSha.flag()}>≠ head</span>
      )}
    </span>
  )
}
