import type {ContentStatus} from '#/components.js'
import type {OverviewRow} from '#/dashboard/atoms/overview.js'
import styler from '@alinea/styler'
import css from './OverviewStatus.module.css'

const styles = styler(css)

export const statusLabel: Record<ContentStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  unpublished: 'Unpublished',
  archived: 'Archived',
  untranslated: 'Untranslated'
}

type StatusRow = Pick<OverviewRow, 'status' | 'main' | 'locale'>

/** The status of a listed entry, untranslated if listed in another locale */
export function overviewStatus(
  row: StatusRow,
  locale?: string | null
): ContentStatus {
  if (locale && row.locale !== locale) return 'untranslated'
  if (row.status === 'archived') return 'archived'
  if (row.status === 'draft') return row.main ? 'unpublished' : 'draft'
  return 'published'
}

export interface OverviewStatusDotProps {
  status: ContentStatus
}

/** The status as a dot after a title, published entries stay quiet */
export function OverviewStatusDot({status}: OverviewStatusDotProps) {
  if (status === 'published') return null
  const label = statusLabel[status]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-status={status}
      className={styles.OverviewStatusDot()}
    />
  )
}
