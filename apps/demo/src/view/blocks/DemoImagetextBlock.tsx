import css from './DemoImagetextBlock.module.scss'

import {fromModule, RichText} from '@alinea/ui'
import {Fragment} from 'react'
import {DemoImage} from '../layout/DemoImage'
import {DemoImagetextBlockSchema} from './DemoImagetextBlock.schema'

const styles = fromModule(css)

export function DemoImagetextBlock({
  container,
  image,
  image_position,
  text
}: DemoImagetextBlockSchema) {
  const Wrapper = container || Fragment

  return (
    <div className={styles.root()}>
      <Wrapper>
        <div className={styles.root.row(image_position)}>
          <div className={styles.root.image()}>
            {image?.src && <DemoImage {...image} />}
          </div>
          <div className={styles.root.content()}>
            <RichText doc={text} />
          </div>
        </div>
      </Wrapper>
    </div>
  )
}
