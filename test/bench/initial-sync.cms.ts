import {createCMS} from '#/core.js'
import {Config, Field} from '#/index.js'

const Page = Config.document('Page', {
  fields: {
    intro: Field.text('Intro', {multiline: true}),
    body: Field.richText('Body'),
    link: Field.link('Link')
  }
})
const Article = Config.document('Article', {
  fields: {
    date: Field.date('Date'),
    intro: Field.text('Intro', {multiline: true}),
    author: Field.entry('Author'),
    body: Field.richText('Body')
  }
})
const Person = Config.document('Person', {
  fields: {
    role: Field.text('Role'),
    bio: Field.text('Bio', {multiline: true})
  }
})
export const cms = createCMS({
  schema: {Page, Article, Person},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {i18n: {locales: ['en', 'nl']}}),
        articles: Config.root('Articles'),
        people: Config.root('People')
      }
    })
  }
})
