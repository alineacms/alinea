import {Entry} from '@alinea/core'
import alinea from 'alinea'

export const HomePage = alinea.type('Homepage', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {hidden: true}),
  intro: alinea.object('Intro', {
    fields: alinea.type('Intro fields', {
      title: alinea.text('Intro title'),
      byline: alinea.richText('Byline')
    })
  }),
  heroPost: alinea.entry('Hero post', {
    condition: Entry.type.is('BlogPost')
  })
})
