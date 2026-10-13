import {Icon, type IconType} from '#/components.js'
import type {EntryStatus} from '#/core/Entry.js'
import styler from '@alinea/styler'
import {
  IcOutlineArchive,
  IcRoundEdit,
  IcRoundTranslate,
  RiFlashlightFill
} from '../icons.js'
import css from './EntryStatusIcon.module.css'

const styles = styler(css)

export interface EntryStatusDisplay {
  icon: IconType
  label: string
  status: 'draft' | 'unpublished' | 'archived' | 'untranslated'
}

/** A listed version of an entry, its draft when it has one */
export interface ListedEntry {
  status?: EntryStatus
  /** The version is the main one, a draft then was never published */
  main?: boolean
  locale: string | null
}

/**
 * How a listed entry differs from a published one, undefined when it does
 * not. With a locale, entries of another locale are untranslated.
 */
export function entryStatus(
  entry: ListedEntry,
  locale: string | null = null
): EntryStatusDisplay | undefined {
  if (locale && entry.locale !== locale)
    return {
      icon: IcRoundTranslate,
      label: 'Untranslated',
      status: 'untranslated'
    }
  if (entry.status === 'archived')
    return {icon: IcOutlineArchive, label: 'Archived', status: 'archived'}
  if (entry.status === 'draft' && entry.main)
    return {icon: RiFlashlightFill, label: 'Unpublished', status: 'unpublished'}
  if (entry.status === 'draft')
    return {icon: IcRoundEdit, label: 'Draft', status: 'draft'}
}

export interface EntryStatusIconProps {
  status: EntryStatusDisplay
}

export function EntryStatusIcon({status}: EntryStatusIconProps) {
  return (
    <span
      className={styles.EntryStatusIcon({[status.status]: true})}
      aria-label={status.label}
      role="img"
      title={status.label}
    >
      <Icon icon={status.icon} className={styles.EntryStatusIcon.icon()} />
    </span>
  )
}
