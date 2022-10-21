import {schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {list} from '@alinea/input.list'
import {select} from '@alinea/input.select'
import {text} from '@alinea/input.text'
import {IcRoundCode} from '@alinea/ui/icons/IcRoundCode'
import {transformCode} from './CodeBlock.server'

export const CodeVariants = list('Variants', {
  inline: true,
  schema: schema({
    Variant: type('Code variant', {
      name: text('Variant name', {inline: true, width: 0.5}),
      language: select('Language', {
        tsx: 'Typescript',
        bash: 'Shell'
      }).configure({inline: true, width: 0.25, initialValue: 'tsx'}),
      code: code('Code', {inline: true, transform: transformCode})
    })
  })
})

export const CodeVariantsBlockSchema = type('Code variants', {
  variants: CodeVariants
}).configure({icon: IcRoundCode})
