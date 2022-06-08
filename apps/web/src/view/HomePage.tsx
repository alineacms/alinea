import {fromModule, HStack, px, Typo, VStack} from '@alinea/ui'
import {IcRoundOpenInNew} from '@alinea/ui/icons/IcRoundOpenInNew'
import {Blocks} from './blocks/Blocks'
import css from './HomePage.module.scss'
import {HomePageSchema} from './HomePage.schema'
import {Hero} from './layout/Hero'

const styles = fromModule(css)

export function HomePage({headline, byline, action, blocks}: HomePageSchema) {
  return (
    <div className={styles.root()}>
      <HomePageHero headline={headline} byline={byline} action={action} />
      <Blocks blocks={blocks} />
    </div>
  )
}

function HomePageHero({
  headline,
  byline,
  action
}: {
  headline: string
  byline?: string
  //TODO: typescript alinea link
  action?: any
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
            <Typo.Link href="/demo" target="_blank">
              <HStack center gap={8}>
                <span>Try the demo</span>
                <IcRoundOpenInNew />
              </HStack>
            </Typo.Link>
          </HStack>
        </VStack>
      </Hero>
    </div>
  )
}
