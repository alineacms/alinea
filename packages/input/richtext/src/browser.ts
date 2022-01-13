import {withView} from '@alinea/core'
import {lazy} from 'react'
import {createRichText} from './RichTextField'
export * from './RichTextField'
export const richText = withView(
  createRichText,
  lazy(() => import('./RichTextInput').then(m => ({default: m.RichTextInput})))
)
