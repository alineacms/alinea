import alinea from 'alinea'

export const ImagetextBlock = alinea.type('Image & text', {
  image: alinea.link.image('Image', {width: 0.75}),
  image_position: alinea.select('Image position', {
    width: 0.25,
    initialValue: 'left',
    options: {
      left: 'Left',
      right: 'Right'
    }
  }),
  text: alinea.richText('Text'),
  button: alinea.link.entry('Button', {
    fields: alinea.type('Fields', {
      label: alinea.text('Button label')
    })
  })
})
