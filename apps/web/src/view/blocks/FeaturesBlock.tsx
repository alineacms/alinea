import {fromModule} from '@alinea/ui'
import {Fragment} from 'react'
import {WebText} from '../layout/WebText'
import css from './FeaturesBlock.module.scss'
import {FeaturesBlockSchema} from './FeaturesBlock.schema'

const styles = fromModule(css)

export function FeaturesBlock({intro, items, container}: FeaturesBlockSchema) {
  const Wrapper = container || Fragment
  if (!intro && items?.length <= 0) return null

  return (
    <div className={styles.root()}>
      <Wrapper>
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
      </Wrapper>
    </div>
  )
}

function Card({text}: any) {
  return <div className={styles.card()}>{text && <WebText doc={text} />}</div>
}
