import {Store} from '@alinea/store/Store'
import {getHighlighter} from 'shiki'
import {Pages} from '../../../.alinea/web'
import {CodeBlockSchema} from './CodeBlock.schema'

export async function codeBlockQuery(pages: Pages, block: CodeBlockSchema) {
  const highlighter = await getHighlighter({
    theme: 'github-light' //'slack-ochin'
  })
  return {
    ...block,
    code:
      block.code &&
      highlighter.codeToHtml(block.code, {lang: block.language || 'tsx'})
  }
}

export type CodeBlockProps = Store.TypeOf<ReturnType<typeof codeBlockQuery>>
