import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {Button} from '@/layout/Button'
import {Label} from '@/layout/Label'
import {resolveLink} from '@/page/sections/links'
import {Sections} from '@/page/sections/Sections'
import type {Landing} from '@/schema/Landing'
import css from './LandingPage.module.scss'

const styles = styler(css)

type LandingData = Infer<typeof Landing>

interface LandingHeadlineProps {
  headline: string
}

/** Text wrapped in *asterisks* renders in the accent color */
function LandingHeadline({headline}: LandingHeadlineProps) {
  const parts = headline.split(/\*([^*]+)\*/)
  return (
    <h1 className={styles.hero.title()}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={styles.hero.accent()}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </h1>
  )
}

interface LandingHeroProps {
  hero: LandingData['hero']
}

function LandingHero({hero}: LandingHeroProps) {
  const primary = resolveLink(hero.button)
  const secondary = resolveLink(hero.link)
  return (
    <header className={styles.hero()}>
      {hero.badge && <Label>{hero.badge}</Label>}
      {hero.headline && <LandingHeadline headline={hero.headline} />}
      {hero.text && <p className={styles.hero.text()}>{hero.text}</p>}
      {(primary || secondary) && (
        <div className={styles.hero.actions()}>
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
    </header>
  )
}

export interface LandingPageProps {
  page: Pick<LandingData, 'hero' | 'sections'>
}

export function LandingPage({page}: LandingPageProps) {
  return (
    <main className={styles.root()}>
      <LandingHero hero={page.hero} />
      <Sections sections={page.sections} />
    </main>
  )
}
