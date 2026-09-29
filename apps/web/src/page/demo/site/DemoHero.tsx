import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import type {DemoHeroBlock} from '@/schema/demo/DemoBlocks'
import {DemoButton} from './DemoButton'
import {DemoImage} from './DemoImage'
import css from './DemoHero.module.scss'
import {demoLink} from './demoLink'

const styles = styler(css)

export interface DemoHeroProps extends Infer<typeof DemoHeroBlock> {
  /** The first block on a page loads its image right away */
  first?: boolean
}

export function DemoHero({
  eyebrow,
  layout,
  title,
  text,
  image,
  credit,
  link,
  first
}: DemoHeroProps) {
  const button = demoLink(link)
  const overlay = layout !== 'split'
  return (
    <section className={styles.DemoHero({overlay, split: !overlay})}>
      <div className={styles.DemoHero.media()}>
        <DemoImage
          image={image}
          eager={first}
          className={styles.DemoHero.image()}
        />
        {credit && <span className={styles.DemoHero.credit()}>{credit}</span>}
      </div>
      <div className={styles.DemoHero.content()}>
        {eyebrow && <p className={styles.DemoHero.eyebrow()}>{eyebrow}</p>}
        <h1 className={styles.DemoHero.title()}>{title}</h1>
        {text && <p className={styles.DemoHero.text()}>{text}</p>}
        {button && (
          <div className={styles.DemoHero.actions()}>
            <DemoButton
              href={button.href}
              variant={overlay ? 'light' : 'solid'}
            >
              {button.label}
            </DemoButton>
          </div>
        )}
      </div>
    </section>
  )
}
