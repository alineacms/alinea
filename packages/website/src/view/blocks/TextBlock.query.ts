import {Cursor} from '@alinea/store'
import {TextBlockSchema} from './TextBlock.schema'

export function textBlockQuery(Block: Cursor<TextBlockSchema>) {
  const Element = Block.get('text')
  const Content = Element.get('content')
  return /*Block.select({
    text: Element.with({
      content: Content.type
    })
  })*/
}
