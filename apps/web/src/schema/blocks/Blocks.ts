import alinea from 'alinea'
import {ColumnsBlock} from './ColumnsBlock'
import {FeaturesBlock} from './FeaturesBlock'
import {ImageBlock} from './ImageBlock'
import {ImagetextBlock} from './ImagetextBlock'
import {TextBlock} from './TextBlock'

export const Blocks = alinea.list('Body', {
  schema: alinea.schema({
    TextBlock,
    ColumnsBlock,
    ImagetextBlock,
    ImageBlock,
    FeaturesBlock
  })
})
