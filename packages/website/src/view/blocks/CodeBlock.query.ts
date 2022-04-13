import {Store} from '@alinea/store/Store'
import {getHighlighter} from 'shiki'
import tsxLanguage from 'shiki/languages/tsx.tmLanguage.json'
import theme from 'shiki/themes/slack-ochin.json'
import {Pages} from '../../../.alinea/web'
import {CodeBlockSchema} from './CodeBlock.schema'

export async function codeBlockQuery(pages: Pages, block: CodeBlockSchema) {
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
    code:
      block.code &&
      highlighter.codeToHtml(block.code, {lang: block.language || 'tsx'})
  }
}

export type CodeBlockProps = Store.TypeOf<ReturnType<typeof codeBlockQuery>>
