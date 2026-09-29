import {Config, Field} from 'alinea'
import {
  componentExampleIds,
  exampleLabel
} from '@/page/catalog/componentCatalog'

export const ComponentExampleBlock = Config.type('Component example', {
  fields: {
    example: Field.select('Example', {
      required: true,
      help: 'A live example of alinea/components with its code, examples live in src/page/catalog/examples',
      options: Object.fromEntries(
        componentExampleIds.map(id => [id, exampleLabel(id)])
      )
    })
  }
})
