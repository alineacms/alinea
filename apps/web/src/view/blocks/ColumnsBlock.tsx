import {fromModule} from '@alinea/ui'
import {Layout} from '../layout/Layout'
import {WebText} from '../layout/WebText'
import css from './ColumnsBlock.module.scss'
import {ColumnsBlockSchema} from './ColumnsBlock.schema'

const styles = fromModule(css)

export function ColumnsBlock({items}: ColumnsBlockSchema) {
  if (items?.length <= 0) return null

  return (
    <div className={styles.root()}>
      <Layout.Container>
        <div className={styles.root.items()}>
          {items.map((item, i) => (
            <div key={i} className={styles.root.items.item()}>
              <WebText doc={item.text} />
            </div>
          ))}
        </div>
      </Layout.Container>
    </div>
  )
}
