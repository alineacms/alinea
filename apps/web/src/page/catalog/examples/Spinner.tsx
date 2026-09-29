'use client'

import {Spinner} from 'alinea/components'

export function SpinnerExample() {
  return (
    <>
      <Spinner size="sm" aria-label="Saving" />
      <Spinner aria-label="Loading products" />
      <Spinner size="lg" aria-label="Loading page" />
      <Spinner size="lg" value={68} aria-label="Uploading linen-shirt.jpg" />
    </>
  )
}
