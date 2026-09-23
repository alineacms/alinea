'use client'

import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import css from './CopyMarkdownButton.module.scss'
import {DocsIconCheck, DocsIconCopy} from './DocsIcons'

const styles = styler(css)

export interface CopyMarkdownButtonProps {
  markdown: string
}

export function CopyMarkdownButton({markdown}: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timeout)
  }, [copied])
  return (
    <button
      type="button"
      className={styles.root()}
      onClick={() => {
        navigator.clipboard
          .writeText(markdown)
          .then(() => setCopied(true))
          .catch(() => {})
      }}
    >
      {copied ? (
        <DocsIconCheck className={styles.root.icon()} />
      ) : (
        <DocsIconCopy className={styles.root.icon()} />
      )}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy as Markdown'}</span>
    </button>
  )
}
