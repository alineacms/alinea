import alinea from 'alinea'

export const ImagetextBlock = alinea.type('Image & text', {
  image: alinea.link.image('Image', {type: 'image', width: 0.75}),
  image_position: alinea.select(
    'Image position',
    {
      left: 'Left',
      right: 'Right'
    },
    {width: 0.25, initialValue: 'left'}
  ),
  text: alinea.richText('Text'),
  button: alinea.link.entry('Button', {
    fields: alinea.type('Fields', {
      label: alinea.text('Button label')
    })
  })
})
