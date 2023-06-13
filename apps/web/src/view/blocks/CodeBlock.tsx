import {Page} from '@alinea/generated'
import {fromModule, Typo} from 'alinea/ui'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {useRef} from 'react'
import {useClipboard} from 'use-clipboard-copy'
import MdiContentCopy from '../../icons/MdiContentCopy'
import css from './CodeBlock.module.scss'

const styles = fromModule(css)

export function CodeBlock({code, compact, fileName}: Page.CodeBlock) {
  const codeRef = useRef<HTMLDivElement>(null)
  const clipboard = useClipboard({
    copiedTimeout: 1200
  })
  return (
    <div className={styles.root({compact, copied: clipboard.copied})}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <div style={{position: 'relative'}}>
        <Typo.Monospace
          as="div"
          ref={codeRef}
          dangerouslySetInnerHTML={{__html: code}}
          className={styles.root.code()}
        />
        <button
          onClick={() => clipboard.copy(codeRef.current!.innerText!)}
          className={styles.root.copy()}
        >
          {clipboard.copied ? (
            <IcRoundCheck style={{fontSize: '24px'}} />
          ) : (
            <MdiContentCopy style={{fontSize: '18px'}} />
          )}
        </button>
      </div>
    </div>
  )
}
