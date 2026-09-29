'use client'

import styler from '@alinea/styler'
import {useEffect, useRef, useState} from 'react'
import {
  IcOutlineInfo,
  IcRoundAutoAwesome,
  IcRoundCheck,
  IcRoundContentCopy
} from '@/icons'
import css from './CopyPrompt.module.scss'

const styles = styler(css)

type CopyStatus = 'idle' | 'copied' | 'failed'

const statusDuration = {copied: 3000, failed: 5000}

export interface CopyPromptProps {
  prompt: string
  /** Shown below the prompt until it is copied */
  hint?: string
  align?: 'start' | 'center'
  className?: string
}

export function CopyPrompt({
  prompt,
  hint = 'Works with Claude Code, Cursor, Codex and more',
  align = 'start',
  className
}: CopyPromptProps) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const promptRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (status === 'idle') return
    const timeout = setTimeout(() => setStatus('idle'), statusDuration[status])
    return () => clearTimeout(timeout)
  }, [status])
  function handleFailure() {
    setStatus('failed')
    // Select the prompt so it can still be copied by hand
    const node = promptRef.current
    const selection = window.getSelection()
    if (node && selection) selection.selectAllChildren(node)
  }
  function handleCopy() {
    if (!navigator.clipboard) return handleFailure()
    navigator.clipboard
      .writeText(prompt)
      .then(() => setStatus('copied'), handleFailure)
  }
  const isCopied = status === 'copied'
  const ButtonIcon = isCopied ? IcRoundCheck : IcRoundContentCopy
  return (
    <div
      className={styles.root(styler.merge({className}), align, {
        copied: status === 'copied',
        failed: status === 'failed'
      })}
    >
      <div className={styles.root.box()}>
        <IcRoundAutoAwesome className={styles.root.icon()} aria-hidden="true" />
        <span ref={promptRef} className={styles.root.prompt()} title={prompt}>
          {prompt}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={styles.root.button()}
        >
          <ButtonIcon
            className={styles.root.button.icon()}
            aria-hidden="true"
          />
          <span className={styles.root.button.label()}>
            {isCopied ? 'Copied' : 'Copy prompt'}
          </span>
        </button>
      </div>
      <p className={styles.root.status()}>
        {status === 'copied' && (
          <IcRoundCheck
            className={styles.root.status.icon()}
            aria-hidden="true"
          />
        )}
        {status === 'failed' && (
          <IcOutlineInfo
            className={styles.root.status.icon()}
            aria-hidden="true"
          />
        )}
        <span className={styles.root.status.label()} role="status">
          {status === 'copied'
            ? 'Copied — paste it into your coding agent'
            : status === 'failed'
              ? 'Could not copy the prompt'
              : ''}
        </span>
        {status === 'idle' && hint && (
          <span className={styles.root.status.hint()}>{hint}</span>
        )}
      </p>
    </div>
  )
}
