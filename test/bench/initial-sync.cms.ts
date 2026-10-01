import {createCMS} from '#/core.js'
import {Config, Field} from '#/index.js'

function blocks() {
  return Field.list('Blocks', {
    schema: {
      Text: Config.type('Text', {
        fields: {title: Field.text('Title'), text: Field.richText('Text')}
      }),
      Image: Config.type('Image', {
        fields: {image: Field.image('Image'), caption: Field.text('Caption')}
      }),
      Cards: Config.type('Cards', {
        fields: {
          title: Field.text('Title'),
          links: Field.link.multiple('Links')
        }
      })
    }
  })
}
const Page = Config.document('Page', {
  fields: {
    code: Field.text('Code', {shared: true}),
    intro: Field.text('Intro', {multiline: true}),
    image: Field.image('Image'),
    body: Field.richText('Body'),
    link: Field.link('Link'),
    blocks: blocks()
  }
})
const Article = Config.document('Article', {
  fields: {
    date: Field.date('Date'),
    intro: Field.text('Intro', {multiline: true}),
    image: Field.image('Image'),
    author: Field.entry('Author'),
    related: Field.entry.multiple('Related'),
    body: Field.richText('Body'),
    blocks: blocks()
  }
})
const Person = Config.document('Person', {
  fields: {
    role: Field.text('Role'),
    image: Field.image('Image'),
    bio: Field.text('Bio', {multiline: true})
  }
})
export const locales = ['en', 'fr', 'nl', 'de']
export const cms = createCMS({
  schema: {Page, Article, Person},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public',
      roots: {
        pages: Config.root('Pages', {i18n: {locales}}),
        articles: Config.root('Articles', {i18n: {locales}}),
        people: Config.root('People'),
        media: Config.media()
      }
    })
  }
})
