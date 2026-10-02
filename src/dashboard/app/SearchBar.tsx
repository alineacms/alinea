import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './SearchBar.module.css'

const styles = styler(css)

export interface SearchBarProps {
  /** The search field, inline so it reads as the row itself */
  children: ReactNode
  /** Compact controls at the end of the row, after a divider */
  controls?: ReactNode
}

/** A search field as the top row of the results it searches */
export function SearchBar({children, controls}: SearchBarProps) {
  return (
    <div className={styles.SearchBar()}>
      <div className={styles.SearchBar.search()}>{children}</div>
      {controls && (
        <>
          <span aria-hidden="true" className={styles.SearchBar.divider()} />
          <div className={styles.SearchBar.controls()}>{controls}</div>
        </>
      )}
    </div>
  )
}
