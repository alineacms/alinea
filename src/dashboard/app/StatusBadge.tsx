import {Badge} from '#/dashboard/app/Badge.js'
import {
  IcOutlineArchive,
  IcRoundCheck,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundLanguage
} from '../icons.js'

type StatusBadgeStatus =
  | 'published'
  | 'unpublished'
  | 'archived'
  | 'draft'
  | 'untranslated'

const statusConfig = {
  published: {label: 'Published', icon: IcRoundCheck},
  unpublished: {label: 'Unpublished', icon: IcRoundFlashOn},
  archived: {label: 'Archived', icon: IcOutlineArchive},
  draft: {label: 'Draft', icon: IcRoundEdit},
  untranslated: {label: 'Untranslated', icon: IcRoundLanguage}
}

interface StatusBadgeProps {
  status: StatusBadgeStatus
}

export function StatusBadge({status}: StatusBadgeProps) {
  const {label, icon} = statusConfig[status]
  return (
    <Badge icon={icon} status={status}>
      {label}
    </Badge>
  )
}
