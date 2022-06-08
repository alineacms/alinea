import {fromModule} from '@alinea/ui'
import Image from 'next/image'
import {Container} from '../layout/Container'
import css from './ImagetextBlock.module.scss'
import {ImagetextBlockSchema} from './ImagetextBlock.schema'

const styles = fromModule(css)

export function ImagetextBlock({
  image,
  image_position,
  text,
  button
}: ImagetextBlockSchema) {
  if (!image?.src && !text && !button) return null

  return (
    <div className={styles.root()}>
      <Container>
        <div className={styles.root.row({right: image_position === 'right'})}>
          {image?.src && (
            <div className={styles.root.image()}>
              <Image
                src={image.src}
                layout="responsive"
                width={image.width}
                height={image.height}
              />
            </div>
          )}
          <div className={styles.root.content()}>
            {text && <div>{text}</div>}
          </div>
        </div>
      </Container>
    </div>
  )
}
