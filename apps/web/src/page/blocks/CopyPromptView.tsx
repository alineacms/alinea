import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {CopyPrompt} from '@/layout/CopyPrompt'
import type {CopyPromptBlock} from '@/schema/blocks/CopyPromptBlock'
import css from './CopyPromptView.module.scss'

const styles = styler(css)

export function CopyPromptView({prompt}: Infer<typeof CopyPromptBlock>) {
  if (!prompt) return null
  return <CopyPrompt prompt={prompt} className={styles.root()} />
}
