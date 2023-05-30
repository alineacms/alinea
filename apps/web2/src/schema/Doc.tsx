import alinea from 'alinea'
import {Blocks} from './blocks/Blocks'

export const Doc = alinea.type('Doc', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5}),
  blocks: Blocks
})
