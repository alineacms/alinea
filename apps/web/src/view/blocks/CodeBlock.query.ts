import {Store} from '@alinea/store/Store'
import {getHighlighter} from 'shiki'
import tsxLanguage from 'shiki/languages/tsx.tmLanguage.json'
import {Pages} from '../../../.alinea/web'
import {theme} from '../types/ShikiTheme'
import {CodeBlockSchema} from './CodeBlock.schema'

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

export async function codeBlockQuery(pages: Pages, block: CodeBlockSchema) {
  try {
    return {
      ...block,
      code:
        block.code &&
        (await highlighter).codeToHtml(block.code, {
          lang: block.language || 'tsx'
        })
    }
  } catch (e) {
    return block
  }
}

export type CodeBlockProps = Store.TypeOf<ReturnType<typeof codeBlockQuery>>
