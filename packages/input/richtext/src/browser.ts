import {withView} from '@alinea/core'
import {createRichText} from './RichTextField'
import {RichTextInput} from './RichTextInput'
export * from './RichTextField'
export * from './RichTextInput'
export const richText = withView(createRichText, RichTextInput)
