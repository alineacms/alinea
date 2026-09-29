'use client'

import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import {DocsIconCheck, DocsIconCopy} from '@/page/docs/DocsIcons'
import css from './CodeCopyButton.module.scss'

const styles = styler(css)

export interface CodeCopyButtonProps {
  code: string
  label?: string
}

export function CodeCopyButton({
  code,
  label = 'Copy code'
}: CodeCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timeout)
  }, [copied])
  return (
    <button
      type="button"
      className={styles.root({copied})}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
      onClick={() => {
        navigator.clipboard
          .writeText(code)
          .then(() => setCopied(true))
          .catch(() => {})
      }}
    >
      {copied ? (
        <DocsIconCheck className={styles.root.icon()} />
      ) : (
        <DocsIconCopy className={styles.root.icon()} />
      )}
    </button>
  )
}
