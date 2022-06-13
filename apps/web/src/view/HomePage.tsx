import {fromModule, HStack, px, VStack} from '@alinea/ui'
import {IcRoundOpenInNew} from '@alinea/ui/icons/IcRoundOpenInNew'
import {Blocks} from './blocks/Blocks'
import css from './HomePage.module.scss'
import {HomePageSchema} from './HomePage.schema'
import {Hero} from './layout/Hero'
import {Image} from './layout/Image'
import {Layout} from './layout/Layout'
import {WebTypo} from './layout/WebTypo'

const styles = fromModule(css)

const exampleCode = `schema('Blog', {
  BlogEntry: type('Blog entry', {
    title: text('Title'),
    author: link('Author', {type: 'entry'}),
  }),
  Author: type('Author', {
    name: text('Name')
  })
})`

export function HomePage({
  headline,
  byline,
  action,
  screenshot,
  blocks
}: HomePageSchema) {
  return (
    <div className={styles.root()}>
      <HomePageHero
        headline={headline}
        byline={byline}
        action={action}
        screenshot={screenshot}
      />
      <Blocks blocks={blocks} container={Layout.Container} />
    </div>
  )
}

function HomePageHero({
  headline,
  byline,
  action,
  screenshot
}: {
  headline: string
  byline?: string
  //TODO: typescript alinea link
  action?: any
  screenshot?: any
}) {
  return (
    <div className={styles.hero()}>
      <Hero>
        <VStack center>
          <Hero.Title>{headline}</Hero.Title>
          <Hero.ByLine>{byline}</Hero.ByLine>
          <HStack
            wrap
            center
            gap={24}
            justify="center"
            style={{paddingTop: px(20)}}
          >
            {action?.url && (
              <Hero.Action href={action.url}>{action.label}</Hero.Action>
            )}
            <WebTypo.Link
              className={styles.hero.demo()}
              href="/demo"
              target="_blank"
            >
              <HStack center gap={8}>
                <span>Try the demo</span>
                <IcRoundOpenInNew />
              </HStack>
            </WebTypo.Link>
          </HStack>
        </VStack>
      </Hero>
      {screenshot && (
        <div className={styles.hero.screenshot()}>
          <Image
            src={screenshot.src}
            width={screenshot.width}
            height={screenshot.height}
            sizes="700px"
            className={styles.hero.screenshot.inner()}
          />
        </div>
      )}
    </div>
  )
}
