import alinea from 'alinea'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'

export const CodeVariants = alinea.list('Variants', {
  inline: true,
  schema: alinea.schema({
    Variant: alinea.type('Code variant', {
      name: alinea.text('Variant name', {inline: true, width: 0.5}),
      language: alinea.select(
        'Language',
        {
          tsx: 'Typescript',
          bash: 'Shell'
        },
        {inline: true, width: 0.25, initialValue: 'tsx'}
      ),
      code: alinea.code('Code', {inline: true})
    })
  })
})

export const CodeVariantsBlock = alinea.type('Code variants', {
  variants: CodeVariants,
  [alinea.type.meta]: {
    icon: IcRoundCode
  }
})
