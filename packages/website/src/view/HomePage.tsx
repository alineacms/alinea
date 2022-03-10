import {fromModule, HStack, Typo} from '@alinea/ui'
import {CodeBlock} from './blocks/CodeBlock'
import css from './HomePage.module.scss'
import {HomePageProps} from './HomePage.query'
import {Container} from './layout/Container'
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

export function HomePage({headline, byline, gettingStarted}: HomePageProps) {
  return (
    <>
      <Hero>
        <HStack wrap gap={80}>
          <div>
            <Hero.Title>{headline}</Hero.Title>
            <Typo.P>{byline}</Typo.P>
            <Hero.Action href={gettingStarted.url}>
              {gettingStarted.title}
            </Hero.Action>
          </div>
        </HStack>
      </Hero>
      <Container className={styles.root.example()}>
        <div style={{display: 'inline-block'}}>
          <CodeBlock code={exampleCode} />
        </div>
      </Container>
    </>
  )
}
