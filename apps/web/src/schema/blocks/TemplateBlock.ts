import {IcRoundArtTrack} from '@/layout/icons/IcRoundArtTrack'
import {Config, Field} from 'alinea'

export const TemplateBlock = Config.type('Template', {
  icon: IcRoundArtTrack,
  fields: {
    image: Field.image('Image', {width: 0.75}),
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
      width: 0.5,
      fields: {
        label: Field.text('Button label')
      }
    }),
    link: Field.link('Link', {
      width: 0.5,
      fields: {
        label: Field.text('Link label')
      }
    })
  }
})
