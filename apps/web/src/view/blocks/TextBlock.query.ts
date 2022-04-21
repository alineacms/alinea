import {Store} from '@alinea/store'
import {Pages} from '../../../.alinea/web'
import {codeBlockQuery} from './CodeBlock.query'
import {codeVariantsBlockQuery} from './CodeVariantsBlock.query'
import {imageBlockQuery} from './ImageBlock.query'
import {TextBlockSchema} from './TextBlock.schema'

export async function textBlockQuery(pages: Pages, block: TextBlockSchema) {
  return {
    ...block,
    text: await Promise.all(
      block.text.map(async item => {
        switch (item.type) {
          case 'CodeBlock':
            return codeBlockQuery(pages, item as any)
          case 'CodeVariantsBlock':
            return codeVariantsBlockQuery(pages, item as any)
          case 'ImageBlock':
            return imageBlockQuery(pages, item as any)
          default:
            return item
        }
      })
    )
  }
}

export type TextBlockProps = Store.TypeOf<ReturnType<typeof textBlockQuery>>
