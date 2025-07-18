import styler from '@alinea/styler'
import {HStack} from 'alinea/ui'
import type {UrlReference} from './UrlPicker.js'
import css from './UrlPickerRow.module.scss'

const styles = styler(css)

export interface UrlPickerRowProps {
  reference: UrlReference
}

export function UrlPickerRow({reference}: UrlPickerRowProps) {
  return (
    <HStack
      gap={16}
      className={styles.root({description: Boolean(reference._title)})}
    >
      <span className={styles.root.url()}>{reference._url}</span>
      {reference._title && (
        <span className={styles.root.desc()}>{reference._title}</span>
      )}
    </HStack>
  )
}
