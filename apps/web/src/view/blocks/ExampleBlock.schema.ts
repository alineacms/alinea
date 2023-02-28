import {type} from 'alinea/core'
import {code} from 'alinea/input/code'
import {transformToUrl} from './ExampleBlock.server'

export const ExampleBlockSchema = type('Example', {
  code: code('Code', {inline: true, transform: transformToUrl})
})
