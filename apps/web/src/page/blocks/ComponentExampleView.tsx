import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {isComponentExampleId} from '@/page/catalog/componentCatalog'
import {ComponentExample} from '@/page/catalog/ComponentExample'
import {DashboardTheme} from '@/page/catalog/DashboardTheme'
import {exampleSource} from '@/page/catalog/exampleSource'
import type {ComponentExampleBlock} from '@/schema/blocks/ComponentExampleBlock'
import {CodeBlockView} from './CodeBlockView'
import css from './ComponentExampleView.module.scss'

const styles = styler(css)

/** A live example of alinea/components above its source */
export function ComponentExampleView({
  example
}: Infer<typeof ComponentExampleBlock>) {
  if (!example || !isComponentExampleId(example)) return null
  const code = exampleSource(example)
  return (
    <figure className={styles.root()}>
      <DashboardTheme className={styles.root.stage()}>
        <ComponentExample example={example} />
      </DashboardTheme>
      {code && (
        <CodeBlockView
          code={code}
          language="tsx"
          fileName={`${example}.tsx`}
          compact={false}
        />
      )}
    </figure>
  )
}
