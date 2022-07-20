import {fromModule} from '@alinea/ui'
import {Fragment} from 'react'
import {Feature, Features} from '../layout/Features'
import {WebText} from '../layout/WebText'
import css from './FeaturesBlock.module.scss'
import {FeaturesBlockSchema} from './FeaturesBlock.schema'

const styles = fromModule(css)

export function FeaturesBlock({items, container}: FeaturesBlockSchema) {
  const Wrapper = container || Fragment
  if (!items?.length) return null
  return (
    <div className={styles.root()}>
      <Wrapper>
        <Features>
          {items.map((item, i) => (
            <Feature key={i}>
              <WebText doc={item.text} />
            </Feature>
          ))}
        </Features>
      </Wrapper>
    </div>
  )
}
