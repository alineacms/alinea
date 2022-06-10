import {fromModule, Typo} from '@alinea/ui'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {useState} from 'react'
import MdiContentCopy from '../../icons/MdiContentCopy'
import css from './CodeBlock.module.scss'
import {CodeBlockSchema} from './CodeBlock.schema'

const styles = fromModule(css)

export function CodeBlock({code, compact, fileName}: CodeBlockSchema) {
  const [isCopied, setIsCopied] = useState(false)

  function handleCopyToClipboard(content) {
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2500)
  }

  return (
    <div className={styles.root({compact, copied: isCopied})}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <Typo.Monospace
        as="div"
        dangerouslySetInnerHTML={{__html: code}}
        className={styles.root.code()}
      />
      <button
        onClick={() => handleCopyToClipboard(code)}
        className={styles.root.copy()}
      >
        {!isCopied && <MdiContentCopy style={{fontSize: '18px'}} />}
        {isCopied && <IcRoundCheck style={{fontSize: '24px'}} />}
      </button>
    </div>
  )
}
