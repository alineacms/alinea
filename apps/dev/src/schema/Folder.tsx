import {Config, Field} from 'alinea'

export const Folder = Config.type('Folder', {
  isContainer: true,
  fields: {
    title: Field.text('Title', {
      width: 0.5
    }),
    path: Field.path('Path', {
      width: 0.5
    })
  }
})
