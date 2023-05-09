import {type} from 'alinea/core'
import {path} from 'alinea/input/path'
import {text} from 'alinea/input/text'
import {Blocks} from './blocks/Blocks'

export const Doc = type('Doc', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5}),
  blocks: Blocks
})
