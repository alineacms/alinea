import {Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {ComponentType} from 'react'
import {transformToUrl} from './ExampleBlock.server'

export const ExampleBlockSchema = type('Example', {
  code: code('Code', {inline: true, transform: transformToUrl})
})

export type ExampleBlockSchema = Schema.TypeOf<typeof ExampleBlockSchema> & {
  container?: ComponentType
}
