import {Config, Field} from 'alinea'
import {metadata} from 'alinea/field'

export const ExtraTabExample = Config.type('Extra root tab', {
  fields: {
    ...Field.tabs(
      Field.tab('Document', {
        fields: {
          title: Field.text('Title', {width: 0.5}),
          path: Field.path('Path', {width: 0.5, readOnly: true})
        }
      }),
      Field.tab('Metadata', {
        fields: {metadata: metadata()}
      }),
      Field.tab('Custom tab', {
        fields: {
          custom: Field.text('Custom field', {width: 1})
        }
      })
    )
  }
})
