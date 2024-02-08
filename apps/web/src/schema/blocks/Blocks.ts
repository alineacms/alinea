import {Field} from 'alinea'
import {ColumnsBlock} from './ColumnsBlock'
import {FeaturesBlock} from './FeaturesBlock'
import {ImageBlock} from './ImageBlock'
import {ImagetextBlock} from './ImagetextBlock'
import {TextBlock} from './TextBlock'

export const Blocks = Field.list('Body', {
  schema: {
    TextBlock,
    ColumnsBlock,
    ImagetextBlock,
    ImageBlock,
    FeaturesBlock
  }
})
