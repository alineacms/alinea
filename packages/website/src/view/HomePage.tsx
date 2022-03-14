import {fromModule, HStack} from '@alinea/ui'
import css from './HomePage.module.scss'
import {HomePageProps} from './HomePage.query'
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

export function HomePage({headline, byline, action}: HomePageProps) {
  return (
    <>
      <Hero>
        <HStack wrap gap={80}>
          <div>
            <Hero.Title>{headline}</Hero.Title>
            <Hero.ByLine>{byline}</Hero.ByLine>
            <Hero.Action href={action.url}>{action.label}</Hero.Action>
          </div>
        </HStack>
      </Hero>
      {/*<Container className={styles.root.example()}>
        <div style={{display: 'inline-block'}}>
          <CodeBlock code={exampleCode} />
        </div>
  </Container>*/}
    </>
  )
}
