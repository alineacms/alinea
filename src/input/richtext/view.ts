import {Field} from 'alinea/core'
import {createRichText} from './RichTextField.js'
import {RichTextInput} from './RichTextInput.js'
export * from './RichTextField.js'
export * from './RichTextInput.js'
export const richText = Field.withView(createRichText, RichTextInput)
