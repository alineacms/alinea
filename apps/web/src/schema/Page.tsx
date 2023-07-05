import alinea from 'alinea'
import {TextField} from './blocks/TextBlock'

export const Page = alinea.type('Page', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5}),
  body: TextField
})
