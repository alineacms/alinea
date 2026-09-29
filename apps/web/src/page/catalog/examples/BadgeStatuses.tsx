'use client'

import {Badge} from 'alinea/components'

export function BadgeStatusesExample() {
  return (
    <>
      <Badge status="published">Published</Badge>
      <Badge status="draft">Draft</Badge>
      <Badge status="unpublished">Unpublished</Badge>
      <Badge status="archived">Archived</Badge>
      <Badge status="untranslated">Untranslated</Badge>
    </>
  )
}
