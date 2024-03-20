import {Config, Field} from 'alinea'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'

export const CodeVariantsBlock = Config.type('Code variants', {
  icon: IcRoundCode,
  fields: {
    variants: Field.list('Variants', {
      inline: true,
      schema: {
        Variant: Config.type('Code variant', {
          fields: {
            name: Field.text('Variant name', {inline: true, width: 0.5}),
            language: Field.select('Language', {
              inline: true,
              width: 0.25,
              initialValue: 'tsx',
              options: {
                tsx: 'Typescript',
                shellscript: 'Shell'
              }
            }),
            code: Field.code('Code', {inline: true})
          }
        })
      }
    })
  }
})
