import {Icon} from '@alinea/components'
import type {EntryStatus as EntryStatusType} from 'alinea/core/Entry'
import {IcRoundEdit, IcRoundFlashOn} from '../icons.js'
import styles from './EntryStatus.module.css'

interface EntryStatusProps {
  status: EntryStatusType
  isUnpublished: boolean
}

export function EntryStatus({status, isUnpublished}: EntryStatusProps) {
  if (isUnpublished) {
    return (
      <span className={styles.unpublished}>
        <Icon icon={IcRoundFlashOn} />
      </span>
    )
  }
  if (status === 'draft') {
    return (
      <span className={styles.draft}>
        <Icon icon={IcRoundEdit} />
      </span>
    )
  }
  return null
}
