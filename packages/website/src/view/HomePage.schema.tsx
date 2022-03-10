import {schema, Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'

export const HomePageSchema = type(
  'Home',
  tabs(
    tab('Homepage', {
      title: text('Title', {
        width: 0.5,
        multiline: true
      }),
      path: path('Path', {width: 0.5}),
      headline: text('Headline', {multiline: true}),
      byline: text('Byline', {multiline: true})
    }),
    tab('Top navigation', {
      links: link('Links', {type: 'entry'}),
      nav: list('Navigation', {
        schema: schema({
          Link: type('Link', {
            link: link('Link', {
              inline: true,
              type: 'entry',
              max: 1,
              width: 0.5
            }),
            title: text('Title', {inline: true, width: 0.5})
          })
        })
      })
    })
  )
).configure({isContainer: true})

export type HomePageSchema = Schema.TypeOf<typeof HomePageSchema>
