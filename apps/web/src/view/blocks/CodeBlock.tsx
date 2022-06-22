import {fromModule, Typo} from '@alinea/ui'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {useRef, useState} from 'react'
import MdiContentCopy from '../../icons/MdiContentCopy'
import css from './CodeBlock.module.scss'
import {CodeBlockSchema} from './CodeBlock.schema'

const styles = fromModule(css)

export function CodeBlock({code, compact, fileName}: CodeBlockSchema) {
  const codeRef = useRef<HTMLDivElement>(null)
  const [isCopied, setIsCopied] = useState(false)

  function handleCopyToClipboard(content: string) {
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1250)
  }

  return (
    <div className={styles.root({compact, copied: isCopied})}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <div style={{position: 'relative'}}>
        <Typo.Monospace
          as="div"
          ref={codeRef}
          dangerouslySetInnerHTML={{__html: code}}
          className={styles.root.code()}
        />
        <button
          onClick={() => handleCopyToClipboard(codeRef.current!.innerText!)}
          className={styles.root.copy()}
        >
          {!isCopied && <MdiContentCopy style={{fontSize: '18px'}} />}
          {isCopied && <IcRoundCheck style={{fontSize: '24px'}} />}
        </button>
      </div>
    </div>
  )
}
