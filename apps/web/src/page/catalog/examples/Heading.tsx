'use client'

import {Heading} from 'alinea/components'

export function HeadingExample() {
  return (
    <div style={{display: 'grid', gap: 8, width: 360}}>
      <Heading as="h1">Oak dining chair</Heading>
      <Heading as="h2">Materials</Heading>
      <Heading as="h3">Care instructions</Heading>
      <Heading as="h2" size="sm" weight="medium" truncate>
        Visual size is independent of the element
      </Heading>
    </div>
  )
}
