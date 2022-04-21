import {Store} from '@alinea/store/Store'
import {getHighlighter} from 'shiki'
import tsxLanguage from 'shiki/languages/tsx.tmLanguage.json'
import {Pages} from '../../../.alinea/web'
import {theme} from '../types/ShikiTheme'
import {CodeVariantsBlockSchema} from './CodeVariantsBlock.schema'

export async function codeVariantsBlockQuery(
  pages: Pages,
  block: CodeVariantsBlockSchema
) {
  const highlighter = await getHighlighter({
    theme: {
      ...theme,
      type: 'light',
      settings: [],
      fg: '#24292f',
      bg: '#fbf9f9'
    },
    langs: [{id: 'tsx', scopeName: 'source.tsx', grammar: tsxLanguage as any}]
  })
  return {
    ...block,
    variants: block.variants.map(variant => {
      return {
        ...variant,
        code:
          variant.code &&
          highlighter.codeToHtml(variant.code, {
            lang: /*variant.language ||*/ 'tsx'
          })
      }
    })
  }
}

export type CodeVariantsBlockProps = Store.TypeOf<
  ReturnType<typeof codeVariantsBlockQuery>
>
