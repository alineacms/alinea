import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {codeHighlighter} from '@/page/blocks/code/CodeHighlighter'
import type {CodeBlock} from '@/schema/blocks/CodeBlock'
import css from './BlogCodeBlock.module.scss'

const styles = styler(css)

export async function BlogCodeBlock({
  code,
  compact,
  fileName,
  language
}: Infer<typeof CodeBlock>) {
  if (!code) return null
  const {codeToHtml} = await codeHighlighter
  const isShell = language === 'shellscript'
  const html = codeToHtml(code, {lang: isShell ? 'shellscript' : 'tsx'})
  const label = fileName || (isShell ? 'Terminal' : 'Code')
  return (
    <div className={styles.root({compact})}>
      <div className={styles.root.header()}>{label}</div>
      <div
        className={styles.root.code()}
        dangerouslySetInnerHTML={{__html: html}}
      />
    </div>
  )
}
