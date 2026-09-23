import styler from '@alinea/styler'
import Link from 'next/link'
import {Logo} from '@/layout/branding/Logo'
import css from './CloudBrand.module.scss'

const styles = styler(css)

export interface CloudBrandProps {
  size?: 'large' | 'small'
}

export function CloudBrand({size = 'large'}: CloudBrandProps) {
  return (
    <Link href="/cloud" className={styles.root({small: size === 'small'})}>
      <Logo
        className={styles.root.logo()}
        style={{fill: '#ffffff'}}
        aria-label="alinea"
      />
      <span className={styles.root.badge()}>Cloud</span>
    </Link>
  )
}
