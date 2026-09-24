import styler from '@alinea/styler'
import type {ComponentType, CSSProperties} from 'react'
import type {ComponentExampleId} from './componentCatalog'
import {componentExampleViews} from './componentExampleViews'
import {DashboardTheme} from './DashboardTheme'
import css from './ComponentThumb.module.scss'

const styles = styler(css)

// Thumbnails are not interactive: keep them out of the tab order and the
// accessibility tree, the card around them is the link
const inert = {inert: true} as object

export interface ComponentThumbProps {
  example: ComponentExampleId
  /** Scale down larger examples to fit the card */
  scale?: number
  /** Width the example is laid out at before scaling */
  width?: number
}

/** A live, non-interactive rendering of an example for the catalog cards */
export function ComponentThumb({example, scale, width}: ComponentThumbProps) {
  const Example: ComponentType | undefined = componentExampleViews[example]
  if (!Example) return null
  const style = {
    zoom: scale,
    width: width ? `${width}px` : undefined
  } satisfies CSSProperties
  return (
    <div className={styles.root()} {...inert}>
      <DashboardTheme className={styles.root.content()}>
        <div className={styles.root.frame()} style={style}>
          <Example />
        </div>
      </DashboardTheme>
    </div>
  )
}
