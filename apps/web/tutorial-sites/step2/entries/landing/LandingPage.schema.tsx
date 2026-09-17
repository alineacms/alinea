import {Config, Field} from 'alinea'
import {ImageBlock} from '@/blocks/image/ImageBlock.schema'
import {TextBlock} from '@/blocks/text/TextBlock.schema'
import {WeatherBlock} from '@/blocks/weather/WeatherBlock.schema'

export const LandingPage = Config.document('Landing page', {
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    path: Field.path('Path', {readOnly: true, width: 0.5, initialValue: ''}),
    blocks: Field.list('Blocks', {
      schema: {
        TextBlock,
        ImageBlock,
        WeatherBlock
      }
    })
  }
})
