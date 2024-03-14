import {Config, Field} from 'alinea'

// alineacms/alinea#353
export const TabsExample = Config.document('Tabs Example', {
  fields: {
    path: Field.path('Path', {
      hidden: true
    }),
    ...Field.tabs(
      Field.tab('Tab 1', {
        fields: {first_title: Field.text('Title')}
      }),
      Field.tab('Tab 2', {
        fields: {another_title: Field.text('Another title')}
      })
    )
  }
})
