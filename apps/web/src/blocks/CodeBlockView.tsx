import {fromModule, Typo} from 'alinea/ui'
//import {useClipboard} from 'use-clipboard-copy'
//import MdiContentCopy from '../../icons/MdiContentCopy'
import {Infer} from 'alinea'
import {CodeBlock} from '../schema/blocks/CodeBlock'
import {codeHighlighter} from './code/CodeHighlighter'
import css from './CodeBlockView.module.scss'

const styles = fromModule(css)

export async function CodeBlockView({
  code,
  compact,
  fileName,
  language
}: Infer<typeof CodeBlock>) {
  const {codeToHtml} = await codeHighlighter
  if (!code) return null
  const html = codeToHtml(code, {
    lang: language === 'shellscript' ? 'shellscript' : 'tsx'
  })
  return (
    <div className={styles.root({compact})}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <div style={{position: 'relative'}}>
        <Typo.Monospace
          as="div"
          dangerouslySetInnerHTML={{__html: html}}
          className={styles.root.code()}
        />
      </div>
    </div>
  )
}
