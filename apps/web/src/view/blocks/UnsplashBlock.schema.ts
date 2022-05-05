import {Schema, type} from '@alinea/core'
import {unsplash} from '@alinea/input.unsplash'
import Unsplash from '@alinea/ui/icons/Unsplash'

export const UnsplashBlockSchema = type('Unsplash', {
  image: unsplash('Unsplash', {
    inline: true,
    multiple: {
      minimum: 1,
      maximum: 9
    }
  })
}).configure({
  icon: Unsplash
})

export type UnsplashBlockSchema = Schema.TypeOf<typeof UnsplashBlockSchema>
