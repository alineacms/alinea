import {fromModule, HStack, px, Typo, VStack} from '@alinea/ui'
import {IcRoundOpenInNew} from '@alinea/ui/icons/IcRoundOpenInNew'
import css from './HomePage.module.scss'
import {HomePageSchema} from './HomePage.schema'
import {Hero} from './layout/Hero'

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

export function HomePage({headline, byline, action}: HomePageSchema) {
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
            <Typo.Link href="/demo" target="_blank">
              <HStack center gap={8}>
                <span>Try the demo</span>
                <IcRoundOpenInNew />
              </HStack>
            </Typo.Link>
          </HStack>
        </VStack>
      </Hero>
      {/*<Container className={styles.root.example()}>
        <div style={{display: 'inline-block'}}>
          <CodeBlock code={exampleCode} />
        </div>
  </Container>*/}
    </div>
  )
}
