import {Config, Field} from 'alinea'

export const PlainType = Config.type('Plain type', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path', {required: true, readOnly: true}),
    ...Field.tabs(
      Field.tab('Tab 1', {
        fields: {first_title: Field.text('Title')}
      }),
      Field.tab('Tab 2', {
        fields: {
          another_title: Field.text('Another title'),
          link: Field.link.multiple('Link')
        }
      })
    )
  }
})
