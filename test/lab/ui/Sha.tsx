import {github} from '../world/github.js'

/** Content shas get a color of their own: the same color is the same content. */
export function shaColor(sha: string) {
  const hue = Number.parseInt(sha.slice(0, 6), 16) % 360
  return `hsl(${hue} 65% 48%)`
}

interface ShaProps {
  sha?: string
  /** Compare with the head of the branch. */
  compare?: boolean
  title?: string
}

export function Sha({sha, compare = true, title}: ShaProps) {
  if (!sha) return <span className="sha sha-none">—</span>
  const head = github.commits.length ? github.head.contentSha : undefined
  const current = head === sha
  return (
    <span
      className={`sha ${compare && head ? (current ? 'sha-head' : 'sha-behind') : ''}`}
      style={{'--sha': shaColor(sha)} as React.CSSProperties}
      title={`${title ? `${title}: ` : ''}${sha}${compare && head ? (current ? ' (head of the branch)' : ' (not the head of the branch)') : ''}`}
    >
      {sha.slice(0, 7)}
      {compare && head && !current && <b className="sha-flag">≠</b>}
    </span>
  )
}
