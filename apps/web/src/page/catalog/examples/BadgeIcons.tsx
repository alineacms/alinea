'use client'

import {Badge} from 'alinea/components'
import {
  IcRoundArchive,
  IcRoundCheck,
  IcRoundEdit,
  IcRoundPublic,
  LucideFile
} from 'alinea/dashboard/icons'

export function BadgeIconsExample() {
  return (
    <>
      <Badge icon={IcRoundCheck} status="published">
        Published
      </Badge>
      <Badge icon={IcRoundEdit} status="draft">
        Draft
      </Badge>
      <Badge icon={IcRoundArchive} status="archived">
        Archived
      </Badge>
      <Badge icon={LucideFile} size="sm">
        Blog post
      </Badge>
      <Badge icon={IcRoundPublic} size="sm">
        Shared
      </Badge>
    </>
  )
}
