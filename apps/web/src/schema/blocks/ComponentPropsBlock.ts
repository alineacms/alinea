import {Config, Field} from 'alinea'
import {componentCatalog} from '@/page/catalog/componentCatalog'

export const ComponentPropsBlock = Config.type('Component props', {
  fields: {
    component: Field.select('Component', {
      required: true,
      help: 'Lists the props of every part of the component, read from its props interfaces',
      options: Object.fromEntries(
        componentCatalog.flatMap(group =>
          group.items.map(item => [item.name, item.name])
        )
      )
    })
  }
})
