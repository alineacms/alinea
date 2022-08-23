import css from './DemoColumnsBlock.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {Fragment} from 'react'
import {DemoColumnsBlockSchema} from './DemoColumnsBlock.schema'

const styles = fromModule(css)

export function DemoColumnsBlock({
  container,
  text_left,
  text_right
}: DemoColumnsBlockSchema) {
  const Wrapper = container || Fragment

  return (
    <div className={styles.root()}>
      <Wrapper>
        <div className={styles.root.left()}>
          <RichText doc={text_left} />
        </div>
        <div className={styles.root.right()}>
          <RichText doc={text_right} />
        </div>
      </Wrapper>
    </div>
  )
}
