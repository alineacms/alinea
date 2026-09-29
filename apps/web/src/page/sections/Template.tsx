import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {imageBlurUrl} from 'alinea/ui'
import {RichText} from 'alinea/ui/RichText'
import NextImage from 'next/image'
import {Button} from '@/layout/Button'
import {Section} from '@/layout/Section'
import type {Template as TemplateSchema} from '@/schema/sections/Template'
import {resolveLink} from './links'
import css from './Template.module.scss'

const styles = styler(css)

export interface TemplateProps extends Infer<typeof TemplateSchema> {}

export function Template({
  image,
  imagePosition,
  title,
  description,
  button,
  link
}: TemplateProps) {
  const primary = resolveLink(button)
  const secondary = resolveLink(link)
  const blurUrl = image?.src ? imageBlurUrl(image) : undefined
  return (
    <Section>
      <div
        className={styles.root({
          right: imagePosition === 'right',
          image: Boolean(image?.src)
        })}
      >
        {image?.src && (
          <div className={styles.root.media()}>
            <NextImage
              src={image.src}
              alt={image.title || ''}
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              placeholder={blurUrl ? 'blur' : 'empty'}
              blurDataURL={blurUrl}
              className={styles.root.image()}
            />
          </div>
        )}
        <div className={styles.root.content()}>
          {title && <h2 className={styles.root.title()}>{title}</h2>}
          {description && (
            <div className={styles.root.description()}>
              <RichText
                doc={description}
                p={<p className={styles.root.text()} />}
                ul={<ul className={styles.root.checks()} />}
                li={<li className={styles.root.check()} />}
                a={<a className={styles.root.link()} />}
              />
            </div>
          )}
          {(primary || secondary) && (
            <div className={styles.root.actions()}>
              {primary && (
                <Button href={primary.href} target={primary.target}>
                  {primary.label}
                </Button>
              )}
              {secondary && (
                <Button
                  variant="secondary"
                  href={secondary.href}
                  target={secondary.target}
                >
                  {secondary.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
