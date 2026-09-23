import styler from '@alinea/styler'
import reactStringReplace from 'react-string-replace'
import css from './DocInlineText.module.scss'

const styles = styler(css)

export interface DocInlineTextProps {
  children: string | undefined
}

/** Text nodes of docs rich text, `backticks` render as inline code */
export function DocInlineText({children}: DocInlineTextProps) {
  if (!children) return null
  return reactStringReplace(children, /`(.+?)`/g, (match, i) => (
    <code className={styles.code()} key={i}>
      {match}
    </code>
  ))
}
