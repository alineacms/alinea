import {fromModule} from '@alinea/ui'
import {Layout} from '../layout/Layout'
import {WebText} from '../layout/WebText'
import css from './FeaturesBlock.module.scss'
import {FeaturesBlockSchema} from './FeaturesBlock.schema'

const styles = fromModule(css)

export function FeaturesBlock({intro, items}: FeaturesBlockSchema) {
  if (!intro && items?.length <= 0) return null

  return (
    <div className={styles.root()}>
      <Layout.Container>
        {intro && (
          <div className={styles.root.intro()}>
            <WebText doc={intro} />
          </div>
        )}
        <div className={styles.root.items()}>
          {items.map((item, i) => (
            <div key={i} className={styles.root.items.item()}>
              <Card {...item} />
            </div>
          ))}
        </div>
      </Layout.Container>
    </div>
  )
}

function Card({text}: any) {
  return <div className={styles.card()}>{text && <WebText doc={text} />}</div>
}
