import {Config, Field} from 'alinea'

export const Blog = Config.document('Blog page', {
  contains: ['Post'],
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    path: Field.path('Path', {
      readOnly: true,
      initialValue: 'blog',
      width: 0.5
    }),
    intro: Field.text('Intro', {multiline: true})
  }
})
