import alinea from 'alinea'

export const ImageBlock = alinea.type('Image', {
  image: alinea.image('Link', {inline: true})
})
