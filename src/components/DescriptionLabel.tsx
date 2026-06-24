import {ReactNode} from 'react'
import css from './DescriptionLabel.module.css'
import styler from '@alinea/styler'

const styles = styler(css)

export function DescriptionLabel({description}: {description?: ReactNode}) {
  return <div className={styles.DescriptionLabel()}>{description}</div>
}
