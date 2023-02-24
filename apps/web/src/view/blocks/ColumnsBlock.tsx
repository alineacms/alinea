import {Page} from 'alinea/content'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {WebText} from '../layout/WebText.js'
import css from './ColumnsBlock.module.scss'

const styles = fromModule(css)

export interface ColumnsBlockProps extends Page.ColumnsBlock {
  container?: ComponentType
}

export function ColumnsBlock({items, container}: ColumnsBlockProps) {
  const Wrapper = container || Fragment
  if (items?.length <= 0) return null

  return (
    <div className={styles.root()}>
      <Wrapper>
        <div className={styles.root.items()}>
          {items.map((item, i) => (
            <div key={i} className={styles.root.items.item()}>
              <WebText doc={item.text} />
            </div>
          ))}
        </div>
      </Wrapper>
    </div>
  )
}
