import styler from '@alinea/styler'
import {StrokeCheck} from '@/icons'
import css from './CheckList.module.scss'

const styles = styler(css)

export interface CheckListItem {
  _id: string
  text: string
}

export interface CheckListProps {
  items: Array<CheckListItem> | null | undefined
  size?: 'medium' | 'large'
  className?: string
}

export function CheckList({items, size = 'medium', className}: CheckListProps) {
  if (!items?.length) return null
  return (
    <ul
      className={styles.root(styler.merge({className}), {
        large: size === 'large'
      })}
    >
      {items.map(item => (
        <li key={item._id} className={styles.root.item()}>
          <StrokeCheck className={styles.root.icon()} />
          <span className={styles.root.text()}>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}
