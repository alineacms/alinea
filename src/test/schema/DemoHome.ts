import {Config, Field} from 'alinea'

export const DemoHome = Config.type('Home', {
  fields: {
    title: Field.text('Title', {width: 0.5, multiline: true}),
    path: Field.path('Path', {width: 0.5}),
    hero: Field.object('Header', {
      fields: {
        header: Field.object('Image', {
          fields: {
            image: Field.image('Image', {inline: true}),
            credit: Field.richText('Credit')
          }
        }),
        title: Field.text('Title', {multiline: true}),
        text: Field.richText('Text')
      }
    })
  }
})
