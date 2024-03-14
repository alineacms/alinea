import {Config, Field} from 'alinea'

export const LayoutExamples = Config.document('Layout fields', {
  fields: {
    object: Field.object('Object field', {
      fields: {
        fieldA: Field.text('Field A', {width: 0.5}),
        fieldB: Field.text('Field B', {width: 0.5})
      }
    }),
    ...Field.tabs(
      Field.tab('Tab A', {
        fields: {tabA: Field.text('Tab A', {shared: true})}
      }),
      Field.tab('Tab B', {
        fields: {tabB: Field.text('Tab B')}
      })
    )
  }
})
