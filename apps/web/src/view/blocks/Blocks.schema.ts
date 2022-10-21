import {schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {ColumnsBlockSchema} from './ColumnsBlock.schema'
import {FeaturesBlockSchema} from './FeaturesBlock.schema'
import {ImageBlockSchema} from './ImageBlock.schema'
import {ImagetextBlockSchema} from './ImagetextBlock.schema'
import {TextBlockSchema} from './TextBlock.schema'
import {TypesBlockSchema} from './TypesBlock.schema'

export const BlocksSchema = list('Body', {
  schema: schema({
    TextBlock: TextBlockSchema,
    TypesBlock: TypesBlockSchema,
    ColumnsBlock: ColumnsBlockSchema,
    ImagetextBlock: ImagetextBlockSchema,
    ImageBlock: ImageBlockSchema,
    FeaturesBlock: FeaturesBlockSchema
  })
})
