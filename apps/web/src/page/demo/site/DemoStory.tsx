import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoStoryBlock} from '@/schema/demo/DemoBlocks'
import type {DemoLocale} from '@/schema/demo/DemoUrl'
import {DemoButton} from './DemoButton'
import {DemoContainer} from './DemoContainer'
import {DemoImage} from './DemoImage'
import css from './DemoStory.module.scss'
import {DemoText} from './DemoText'
import {demoLink} from './demoLink'

const styles = styler(css)

export interface DemoStoryProps extends Infer<typeof DemoStoryBlock> {
  locale: DemoLocale
}

export function DemoStory({
  locale,
  eyebrow,
  imagePosition,
  title,
  text,
  image,
  credit,
  link
}: DemoStoryProps) {
  const button = demoLink(link)
  return (
    <section className={styles.DemoStory()}>
      <DemoContainer>
        <div
          className={styles.DemoStory.inner({
            reversed: imagePosition === 'right'
          })}
        >
          <figure className={styles.DemoStory.media()}>
            <DemoImage
              image={image}
              ratio="4 / 5"
              className={styles.DemoStory.image()}
            />
            {credit && (
              <figcaption className={styles.DemoStory.credit()}>
                {credit}
              </figcaption>
            )}
          </figure>
          <div className={styles.DemoStory.content()}>
            {eyebrow && <p className={styles.DemoStory.eyebrow()}>{eyebrow}</p>}
            {title && <h2 className={styles.DemoStory.title()}>{title}</h2>}
            <DemoText doc={text} locale={locale} size="large" />
            {button && (
              <DemoButton href={button.href} variant="text">
                {button.label}
              </DemoButton>
            )}
          </div>
        </div>
      </DemoContainer>
    </section>
  )
}
