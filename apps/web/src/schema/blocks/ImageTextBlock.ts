import {Config, Field} from 'alinea'
import {IcRoundArtTrack} from '@/layout/icons/IcRoundArtTrack'

export const ImageTextBlock = Config.type('Image & text', {
  icon: IcRoundArtTrack,
  fields: {
    image: Field.image('Image', {
      width: 0.75,
      fields: {
        alt: Field.text('Alt', {required: true})
      }
    }),
    imagePosition: Field.select('Image position', {
      width: 0.25,
      options: {
        left: 'Left',
        right: 'Right'
      }
    }),
    title: Field.text('Title'),
    description: Field.richText('Description'),
    button: Field.link('Button', {
      fields: {
        label: Field.text('Button label')
      }
    })
  }
})
