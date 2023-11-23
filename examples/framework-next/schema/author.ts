import alinea from 'alinea'

export const Author = alinea.type('Author', {
  title: alinea.text('Name'),
  path: alinea.path('Path', {hidden: true}),
  picture: alinea.image('Image')
})
