'use client'

import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import {IcRoundCheck, IcRoundContentCopy} from '@/icons'
import css from './InstallCommand.module.scss'

const styles = styler(css)

export interface InstallCommandProps {
  command?: string
  className?: string
}

export function InstallCommand({
  command = 'npx alinea init',
  className
}: InstallCommandProps) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])
  function handleCopy() {
    navigator.clipboard.writeText(command).then(
      () => setCopied(true),
      () => setCopied(false)
    )
  }
  const CopyIcon = copied ? IcRoundCheck : IcRoundContentCopy
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : `Copy "${command}"`}
      title={copied ? 'Copied' : 'Copy to clipboard'}
      className={styles.root(styler.merge({className}), {copied})}
    >
      <span className={styles.root.command()}>
        <span className={styles.root.prompt()}>$</span> {command}
      </span>
      <CopyIcon className={styles.root.icon()} />
    </button>
  )
}
