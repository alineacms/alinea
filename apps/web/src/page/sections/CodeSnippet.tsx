import styler from '@alinea/styler'
import {codeHighlighter} from '@/page/blocks/code/CodeHighlighter'
import css from './CodeSnippet.module.scss'

const styles = styler(css)

export type CodeSnippetSize = 'small' | 'medium' | 'large'

export interface CodeSnippetProps {
  code: string | null | undefined
  filename?: string | null
  size?: CodeSnippetSize
  className?: string
}

function languageOf(code: string, filename?: string | null) {
  if (filename && /\.(sh|bash)$/.test(filename)) return 'shellscript'
  if (code.startsWith('$ ')) return 'shellscript'
  return 'tsx'
}

/** Highlighted code on the navy code background, with an optional file name */
export async function CodeSnippet({
  code,
  filename,
  size = 'medium',
  className
}: CodeSnippetProps) {
  if (!code) return null
  const {codeToHtml} = await codeHighlighter
  const source = code.replace(/\s+$/, '')
  const html = codeToHtml(source, {lang: languageOf(source, filename)})
  return (
    <div className={styles.root(styler.merge({className}), size)}>
      {filename && <div className={styles.root.filename()}>{filename}</div>}
      <div
        className={styles.root.code()}
        dangerouslySetInnerHTML={{__html: html}}
      />
    </div>
  )
}
