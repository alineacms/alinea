import styler from '@alinea/styler'
import type {Link as AnyLink, Infer} from 'alinea'
import {HStack, VStack} from 'alinea/ui'
import {px} from '@/utils/units'
import screenshot from '@/assets/vetra.png'
import {IcRoundOpenInNew} from '@/icons'
import {Button} from '@/layout/Button'
import {Image} from '@/layout/Image'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import type {TemplateBlock} from '@/schema/blocks/TemplateBlock'
import css from './TemplateBlock.module.scss'

const styles = styler(css)

function isUrlLink(link: AnyLink<{label: string}>) {
  return link._type === 'url'
}

type TemplateBlockProps = Infer<typeof TemplateBlock>
export function TemplateBlockView({
  image,
  imagePosition,
  title,
  description,
  button,
  link
}: TemplateBlockProps) {
  return (
    <section className={styles.root(imagePosition)}>
      {image?.src && (
        <Image
          {...image}
          sizes="(max-width: 768px) 100vw, 50vw"
          className={styles.root.illustration()}
        />
      )}
      <VStack gap={16}>
        <WebTypo>
          {title && <WebTypo.H2>Get started with a template</WebTypo.H2>}
          {description && <WebText doc={description} listStyle="checkmark" />}
        </WebTypo>
        {(button?.href || link?.href) && (
          <HStack wrap gap={`${px(16)} ${px(24)}`} center>
            {button?.href && (
              <Button {...button}>{button.fields.label || button.title}</Button>
            )}
            {link?.href && (
              <WebTypo.Link
                href={link.href}
                target={isUrlLink(link) ? link.target : undefined}
              >
                <HStack gap={8} center>
                  <span>{link.fields.label || link.title}</span>
                  {isUrlLink(link) && link.target === '_blank' && (
                    <IcRoundOpenInNew />
                  )}
                </HStack>
              </WebTypo.Link>
            )}
          </HStack>
        )}
      </VStack>
    </section>
  )
}
