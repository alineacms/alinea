import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {CodeBlock} from '@/schema/blocks/CodeBlock'
import css from './CodeBlockView.module.scss'
import {CodeCopyButton} from './code/CodeCopyButton'
import {codeHighlighter, codeLanguage} from './code/CodeHighlighter'
import {withCodeClasses} from './code/CodeHtml'

const styles = styler(css)

export async function CodeBlockView({
  code,
  compact,
  fileName,
  language
}: Infer<typeof CodeBlock>) {
  const {codeToHtml} = await codeHighlighter
  if (!code) return null
  const lang = codeLanguage(language)
  const isShell = lang === 'shellscript'
  const html = withCodeClasses(codeToHtml(code, {lang}), {
    pre: styles.root.pre(),
    code: styles.root.code(),
    line: styles.root.line({prompt: isShell})
  })
  const label = fileName || (isShell ? 'Terminal' : '')
  return (
    <div className={styles.root({compact})}>
      <div className={styles.root.bar()}>
        <span className={styles.root.bar.label()}>{label}</span>
        <CodeCopyButton code={code} />
      </div>
      <div
        className={styles.root.body()}
        dangerouslySetInnerHTML={{__html: html}}
      />
    </div>
  )
}
