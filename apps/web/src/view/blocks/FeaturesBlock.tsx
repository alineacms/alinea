import {Page} from '@alinea/content'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {Feature, Features} from '../layout/Features'
import {WebText} from '../layout/WebText'
import css from './FeaturesBlock.module.scss'

const styles = fromModule(css)

export interface FeaturesBlockProps extends Page.FeaturesBlock {
  container?: ComponentType
}

export function FeaturesBlock({items, container}: FeaturesBlockProps) {
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
