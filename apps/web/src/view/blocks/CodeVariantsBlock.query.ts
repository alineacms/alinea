import {Store} from '@alinea/store/Store'
import {getHighlighter} from 'shiki'
import tsxLanguage from 'shiki/languages/tsx.tmLanguage.json'
import {Pages} from '../../../.alinea/web'
import {theme} from '../types/ShikiTheme'
import {CodeVariantsBlockSchema} from './CodeVariantsBlock.schema'

const highlighter = getHighlighter({
  theme: {
    ...theme,
    type: 'light',
    settings: [],
    fg: '#24292f',
    bg: '#fbf9f9'
  },
  langs: [{id: 'tsx', scopeName: 'source.tsx', grammar: tsxLanguage as any}]
})

export async function codeVariantsBlockQuery(
  pages: Pages,
  block: CodeVariantsBlockSchema
) {
  return {
    ...block,
    variants: await Promise.all(
      block.variants.map(async variant => {
        return {
          ...variant,
          code:
            variant.code &&
            (await highlighter).codeToHtml(variant.code, {
              lang: /*variant.language ||*/ 'tsx'
            })
        }
      })
    )
  }
}

export type CodeVariantsBlockProps = Store.TypeOf<
  ReturnType<typeof codeVariantsBlockQuery>
>
