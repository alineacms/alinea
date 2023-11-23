import alinea from 'alinea'

export const Docs = alinea.type('Docs', {
  title: alinea.text('Title', {width: 0.5, multiline: true}),
  path: alinea.path('Path', {width: 0.5}),
  [alinea.meta]: {
    isContainer: true,
    contains: ['Doc', 'Docs']
  }
})
