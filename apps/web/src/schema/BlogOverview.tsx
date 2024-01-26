import alinea from 'alinea'

export const BlogOverview = alinea.type('Blog overview', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5}),
  [alinea.meta]: {
    contains: ['BlogPost']
  }
})
