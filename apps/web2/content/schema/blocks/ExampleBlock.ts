import alinea from 'alinea'

export const ExampleBlock = alinea.type('Example', {
  code: alinea.code('Code', {inline: true})
})
