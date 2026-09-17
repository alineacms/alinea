import {Config, Field} from 'alinea'

export const SiteLayout = Config.type('Site layout', {
  preview: false,
  fields: {
    title: Field.text('Entry title', {
      initialValue: 'Global settings',
      width: 0.5
    }),
    path: Field.path('Path', {
      readOnly: true,
      initialValue: 'settings',
      width: 0.5
    }),
    headerText: Field.text('Header text', {required: true}),
    footerText: Field.text('Footer text', {required: true})
  }
})
