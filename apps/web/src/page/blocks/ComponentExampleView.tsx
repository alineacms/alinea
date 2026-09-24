import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {ComponentType} from 'react'
import {isComponentExampleId} from '@/page/catalog/componentCatalog'
import {componentExampleViews} from '@/page/catalog/componentExampleViews'
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
  const Example: ComponentType | undefined = componentExampleViews[example]
  if (!Example) return null
  const code = exampleSource(example)
  return (
    <figure className={styles.root()}>
      <DashboardTheme className={styles.root.stage()}>
        <Example />
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
