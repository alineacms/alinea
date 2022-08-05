import css from './DemoTextBlock.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {Fragment} from 'react'
import {DemoTextBlockSchema} from './DemoTextBlock.schema'

const styles = fromModule(css)

export function DemoTextBlock({text, container}: DemoTextBlockSchema) {
  const Wrapper = container || Fragment

  return (
    <div className={styles.root()}>
      <Wrapper>
        <RichText doc={text} />
      </Wrapper>
    </div>
  )
}
