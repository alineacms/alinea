import {fromModule, HStack, Icon} from '@alinea/ui'
import Link, {LinkProps} from 'next/link'
import type {ComponentType} from 'react'
import {PropsWithChildren} from 'react'
import {Image} from '../layout/Image'
import {Layout} from '../layout/Layout'
import {WebText} from '../layout/WebText'
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
      <Layout.Container>
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
              {button?.url && <Button href={button.url}>{button.label}</Button>}
            </div>
          )}
        </div>
      </Layout.Container>
    </div>
  )
}

function Button({
  children,
  icon,
  iconRight,
  ...props
}: PropsWithChildren<LinkProps> & {
  icon?: ComponentType
  iconRight?: ComponentType
}) {
  return (
    <Link {...props}>
      <a className={styles.button()}>
        <HStack center gap={8}>
          <Icon icon={icon} />
          <span>{children}</span>
          <Icon icon={iconRight} />
        </HStack>
      </a>
    </Link>
  )
}
