import {Field} from '@alinea/core'
import {createUnsplash} from './UnsplashField'
import {UnsplashInput} from './UnsplashInput'
export * from './UnsplashField'
export * from './UnsplashInput'
export const unsplash = Field.withView(createUnsplash, UnsplashInput)
