import {Expr, Store} from '@alinea/store'
import {Pages} from '../../../.alinea/web'
import {codeBlockQuery} from './CodeBlock.query'
import {imageBlockQuery} from './ImageBlock.query'
import {TextBlockSchema} from './TextBlock.schema'

export function textBlockQuery(pages: Pages, text: Expr<TextBlockSchema>) {
  return pages.processTypes(text, {
    ImageBlock: block => imageBlockQuery(pages, block),
    CodeBlock: block => codeBlockQuery(pages, block)
  })
}

export type TextBlockProps = Store.TypeOf<ReturnType<typeof textBlockQuery>>
