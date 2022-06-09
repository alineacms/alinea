import {fromModule, HStack, px, VStack} from '@alinea/ui'
import {IcRoundOpenInNew} from '@alinea/ui/icons/IcRoundOpenInNew'
import Image from 'next/image'
import css from './HomePage.module.scss'
import {HomePageSchema} from './HomePage.schema'
import {Hero} from './layout/Hero'
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
  screenshot
}: HomePageSchema) {
  return (
    <div className={styles.root()}>
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
            {action && (
              <Hero.Action href={action.url}>{action.label}</Hero.Action>
            )}
            <WebTypo.Link
              className={styles.root.demo()}
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
        <div className={styles.root.screenshot()}>
          <Image
            src={screenshot.src}
            width={screenshot.width}
            height={screenshot.height}
          />
        </div>
      )}
    </div>
  )
}
