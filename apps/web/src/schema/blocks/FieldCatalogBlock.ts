import {Config, Field} from 'alinea'

export const FieldCatalogBlock = Config.type('Field catalog', {
  fields: {
    showKind: Field.check('Show the fields and components explainer', {
      initialValue: true,
      help: 'Two cards above the catalog that explain the difference between fields and dashboard components'
    })
  }
})
