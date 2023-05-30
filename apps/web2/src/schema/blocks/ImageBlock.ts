import alinea from 'alinea'

export const ImageBlock = alinea.type('Image', {
  image: alinea.link.image('Link', {inline: true})
})
