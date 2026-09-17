import {CodeVariantsBlock} from '@/schema/blocks/CodeVariantsBlock'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import {CodeVariantTabs} from './CodeVariantsView.client'
import css from './CodeVariantsView.module.scss'
import {codeHighlighter} from './code/CodeHighlighter'

const styles = styler(css)

export interface CodeVariantsViewProps
  extends Infer<typeof CodeVariantsBlock> {}

export async function CodeVariantsView({variants}: CodeVariantsViewProps) {
  const {codeToHtml} = await codeHighlighter
  const withHtml = variants
    .filter(variant => variant.code)
    .map(variant => {
      const html = codeToHtml(variant.code, {
        lang: variant.language!
      })
      return {...variant, code: html}
    })
  return <CodeVariantTabs variants={withHtml} />
}
