import {Config, Field} from 'alinea'

export const ComponentCatalogBlock = Config.type('Component catalog', {
  fields: {
    showKind: Field.check('Show the fields and components explainer', {
      initialValue: true,
      help: 'Two cards above the catalog that explain the difference between fields and dashboard components'
    })
  }
})
