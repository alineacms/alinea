import {schema, Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {list} from '@alinea/input.list'
import {text} from '@alinea/input.text'
import {MdCode} from 'react-icons/md'

export const CodeVariantsBlockSchema = type('Code variants', {
  variants: list('Variants', {
    inline: true,
    schema: schema({
      Variant: type('Variant', {
        name: text('Variant name', {inline: true, width: 0.5}),
        code: code('Code', {inline: true})
      })
    })
  })
}).configure({icon: MdCode})

export type CodeVariantsBlockSchema = Schema.TypeOf<
  typeof CodeVariantsBlockSchema
>
