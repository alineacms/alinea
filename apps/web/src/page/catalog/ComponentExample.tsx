'use client'

import dynamic from 'next/dynamic'
import type {ComponentExampleId} from './componentCatalog'

export interface ComponentExampleProps {
  example: ComponentExampleId
}

/**
 * Renders an example of alinea/components. The examples, the components and
 * the dashboard stylesheet are split off, so only pages that show an example
 * load them.
 */
export const ComponentExample = dynamic<ComponentExampleProps>(() =>
  import('./componentExampleViews').then(({componentExampleViews}) => {
    return function ComponentExample({example}: ComponentExampleProps) {
      const Example = componentExampleViews[example]
      return <Example />
    }
  })
)
