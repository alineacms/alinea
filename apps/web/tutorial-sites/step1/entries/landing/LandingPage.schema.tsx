import {Config, Field} from 'alinea'

export const LandingPage = Config.document('Landing page', {
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    path: Field.path('Path', {readOnly: true, width: 0.5, initialValue: ''})
  }
})
