import {styler} from '@alinea/styler'
import {
  BreadcrumbProps,
  type BreadcrumbsProps,
  Breadcrumb as RACBreadcrumb,
  Breadcrumbs as RACBreadcrumbs
} from 'react-aria-components'
import css from './Breadcrumbs.module.css'

const styles = styler(css)

export function Breadcrumbs<T extends object>(props: BreadcrumbsProps<T>) {
  return (
    <RACBreadcrumbs
      {...props}
      className={styles.Breadcrumbs(styler.merge(props))}
    />
  )
}

export function Breadcrumb(props: BreadcrumbProps) {
  return <RACBreadcrumb {...props} className={styles.Breadcrumb()} />
}
