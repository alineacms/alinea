import type {Infer} from 'alinea'
import {withSiteUrl} from '@/cms'
import {CopyPrompt} from '@/layout/CopyPrompt'
import type {CopyPromptBlock} from '@/schema/blocks/CopyPromptBlock'

export function CopyPromptView({prompt}: Infer<typeof CopyPromptBlock>) {
  if (!prompt) return null
  return <CopyPrompt prompt={withSiteUrl(prompt)} />
}
