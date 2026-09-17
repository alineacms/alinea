import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Typo, VStack} from 'alinea/ui'
import {Button} from '@/layout/Button'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import type {CodeTextBlock} from '@/schema/blocks/CodeTextBlock'
import css from './CodeTextBlockView.module.scss'
import {codeHighlighter} from './code/CodeHighlighter'

const styles = styler(css)

type CodeTextBlockProps = Infer<typeof CodeTextBlock>
export async function CodeTextBlockView({
  code,
  codePosition,
  title,
  description,
  button
}: CodeTextBlockProps) {
  const {codeToHtml} = await codeHighlighter
  if (!code && (!title || !description)) return null
  const html = codeToHtml(code, {lang: 'tsx'})
  return (
    <section className={styles.root(codePosition)}>
      <div className={styles.root.content()}>
        <VStack gap={16}>
          <WebTypo>
            {title && <WebTypo.H2>{title}</WebTypo.H2>}
            {description && <WebText doc={description} listStyle="checkmark" />}
          </WebTypo>
          {button?.href && (
            <Button {...button}>{button.fields.label || button.title}</Button>
          )}
        </VStack>
      </div>
      {code && (
        <div className={styles.root.code()}>
          <Typo.Monospace
            as="div"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
            dangerouslySetInnerHTML={{__html: html}}
            className={styles.root.code()}
          />
        </div>
      )}
    </section>
  )
}
