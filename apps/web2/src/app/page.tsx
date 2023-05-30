import {pages} from '@/cms'
import {Home} from '@/schema/Home'
import {fromModule} from 'alinea/ui/util/Styler'
import {Hero} from '../layout/Hero'
import {LayoutContainer} from '../layout/Layout'
import {WebTypo} from '../layout/WebTypo'
import heroBg from '../media/hero.jpg'
import css from './home.module.scss'

const styles = fromModule(css)

export default async function HomePage() {
  const homePage = await pages.find(Home().first())
  return (
    <div className={styles.home()}>
      <HomePageHero {...homePage} />
    </div>
  )
}

function HomePageHero({
  headline,
  byline,
  action,
  screenshot
}: typeof Home.infer) {
  return (
    <div
      className={styles.hero()}
      style={{backgroundImage: `url(${heroBg.src})`}}
    >
      <Hero>
        <LayoutContainer>
          <div>
            <Hero.Title>{headline}</Hero.Title>
            <Hero.ByLine>{byline}</Hero.ByLine>
            <div>
              {action?.url && (
                <Hero.Action href={action.url}>{action.label}</Hero.Action>
              )}
              <WebTypo.Link
                className={styles.hero.demo()}
                href="https://demo.alinea.sh"
                target="_blank"
              >
                <div>
                  <span>Try the demo</span>
                </div>
              </WebTypo.Link>
            </div>
          </div>
        </LayoutContainer>
      </Hero>
    </div>
  )
}
