'use client'

import {Badge} from 'alinea/components'

export function BadgeExample() {
  return (
    <>
      <Badge status="published">Published</Badge>
      <Badge status="draft">Draft</Badge>
      <Badge>Page</Badge>
    </>
  )
}
