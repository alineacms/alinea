import {fromModule} from '@alinea/ui'
import {Fragment} from 'react'
import {Button} from '../layout/Button'
import {Image} from '../layout/Image'
import {WebText} from '../layout/WebText'
import css from './ImagetextBlock.module.scss'
import {ImagetextBlockSchema} from './ImagetextBlock.schema'

const styles = fromModule(css)

export function ImagetextBlock({
  image,
  image_position,
  text,
  button,
  container
}: ImagetextBlockSchema) {
  const Wrapper = container || Fragment
  if (!image?.src && !text && !button) return null

  return (
    <div className={styles.root()}>
      <Wrapper>
        <div className={styles.root.row({right: image_position === 'right'})}>
          {image?.src && (
            <div className={styles.root.image()}>
              <Image
                src={image.src}
                width={image.width}
                height={image.height}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          )}
          {(text || button?.url) && (
            <div className={styles.root.content()}>
              {text && <WebText doc={text} />}
              {button?.url && (
                <Button
                  href={button.url}
                  className={styles.root.content.button()}
                >
                  {button.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </Wrapper>
    </div>
  )
}
