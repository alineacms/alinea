import {Page} from 'alinea/content'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {Button} from '../layout/Button.js'
import {Image} from '../layout/Image.js'
import {WebText} from '../layout/WebText.js'
import css from './ImagetextBlock.module.scss'

const styles = fromModule(css)

export interface ImagetextBlockProps extends Page.ImagetextBlock {
  container?: ComponentType
}

export function ImagetextBlock({
  image,
  image_position,
  text,
  button,
  container
}: ImagetextBlockProps) {
  const Wrapper = container || Fragment
  if (!image?.src && !text && !button) return null

  return (
    <div className={styles.root()}>
      <Wrapper>
        <div
          className={styles.root.row({right: image_position[0] === 'right'})}
        >
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
