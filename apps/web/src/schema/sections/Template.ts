import {Config, Field} from 'alinea'
import {IcRoundArtTrack} from '@/layout/icons/IcRoundArtTrack'
import {anchorField, labeledLink} from './options'

export const Template = Config.type('Template', {
  icon: IcRoundArtTrack,
  fields: {
    image: Field.image('Image', {width: 0.75}),
    imagePosition: Field.select('Image position', {
      width: 0.25,
      initialValue: 'left',
      options: {
        left: 'Left',
        right: 'Right'
      }
    }),
    title: Field.text('Title'),
    description: Field.richText('Description', {
      help: 'Bullet lists render as check marks'
    }),
    button: labeledLink('Button', 0.5),
    link: labeledLink('Link', 0.5),
    anchor: anchorField()
  }
})
