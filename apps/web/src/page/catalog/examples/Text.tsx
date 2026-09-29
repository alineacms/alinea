'use client'

import {Text} from 'alinea/components'

export function TextExample() {
  return (
    <div style={{display: 'grid', gap: 8, width: 360}}>
      <Text as="p" size="lg">
        Stonewashed linen that softens with every wash.
      </Text>
      <Text as="p">
        Our <Text weight="semibold">Linen shirt</Text> is cut from European
        flax.
      </Text>
      <Text as="p" size="sm" color="muted">
        Last edited by Maya Janssens
      </Text>
      <Text color="success">In stock</Text>
      <Text color="warning">Low stock</Text>
      <Text color="destructive">Sold out</Text>
    </div>
  )
}
