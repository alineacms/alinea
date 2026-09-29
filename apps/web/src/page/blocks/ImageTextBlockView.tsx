import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {VStack} from 'alinea/ui'
import {Button} from '@/layout/Button'
import {Image} from '@/layout/Image'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import type {ImageTextBlock} from '@/schema/blocks/ImageTextBlock'
import css from './ImageTextBlockView.module.scss'

const styles = styler(css)

type ImageTextBlockProps = Infer<typeof ImageTextBlock>
export function ImageTextBlockView({
  image,
  imagePosition,
  title,
  description,
  button
}: ImageTextBlockProps) {
  if (!image?.src && (!title || !description)) return null

  return (
    <section className={styles.root(imagePosition)}>
      {image?.src && (
        <Image
          {...image}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className={styles.root.image()}
        />
      )}
      <div className={styles.root.content()}>
        <VStack gap={16}>
          <WebTypo>
            {title && <WebTypo.H2>{title}</WebTypo.H2>}
            {description && <WebText doc={description} listStyle="checkmark" />}
          </WebTypo>
          {button?.href && (
            <Button {...button}>{button.fields.label || button.title}</Button>
          )}
        </VStack>
      </div>
    </section>
  )
}
