import {Config, Field} from 'alinea'

export const ImagetextBlock = Config.type('Image & text', {
  fields: {
    image: Field.link.image('Image', {width: 0.75}),
    image_position: Field.select('Image position', {
      width: 0.25,
      initialValue: 'left',
      options: {
        left: 'Left',
        right: 'Right'
      }
    }),
    text: Field.richText('Text'),
    button: Field.link.entry('Button', {
      fields: {
        label: Field.text('Button label')
      }
    })
  }
})
