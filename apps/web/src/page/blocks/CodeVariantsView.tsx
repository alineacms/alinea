import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {CodeVariantsBlock} from '@/schema/blocks/CodeVariantsBlock'
import {CodeVariantTabs} from './CodeVariantsView.client'
import css from './CodeVariantsView.module.scss'
import {codeHighlighter} from './code/CodeHighlighter'
import {withCodeClasses} from './code/CodeHtml'

const styles = styler(css)

export interface CodeVariantsViewProps extends Infer<
  typeof CodeVariantsBlock
> {}

export async function CodeVariantsView({variants}: CodeVariantsViewProps) {
  const {codeToHtml} = await codeHighlighter
  const highlighted = variants
    .filter(variant => variant.code)
    .map(variant => {
      const isShell = variant.language === 'shellscript'
      const html = withCodeClasses(
        codeToHtml(variant.code, {lang: isShell ? 'shellscript' : 'tsx'}),
        {
          pre: styles.pre(),
          code: styles.code(),
          line: styles.line({prompt: isShell})
        }
      )
      return {
        id: variant._id,
        name: variant.name || 'Code',
        code: variant.code,
        html
      }
    })
  if (highlighted.length === 0) return null
  return <CodeVariantTabs variants={highlighted} />
}
