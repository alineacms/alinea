import {Expr, Store} from '@alineacms/store'
import {Pages} from '../../../.alinea/web'
import {imageBlockQuery} from './ImageBlock.query'
import {TextBlockSchema} from './TextBlock.schema'

export function textBlockQuery(pages: Pages, text: Expr<TextBlockSchema>) {
  return pages.processTypes(text, {
    ImageBlock: block => imageBlockQuery(pages, block)
  })
}

export type TextBlockProps = Store.TypeOf<ReturnType<typeof textBlockQuery>>
