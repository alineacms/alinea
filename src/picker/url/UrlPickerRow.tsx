import {fromModule, HStack} from 'alinea/ui'
import {UrlReference} from './UrlPicker.js'
import css from './UrlPickerRow.module.scss'

const styles = fromModule(css)

export interface UrlPickerRowProps {
  reference: UrlReference
}

export function UrlPickerRow({reference}: UrlPickerRowProps) {
  return (
    <HStack gap={15} className={styles.root()}>
      <span className={styles.root.url()}>{reference._url}</span>
      <span className={styles.root.desc()}>{reference._title}</span>
    </HStack>
  )
}
