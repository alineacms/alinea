import {Config, Field} from 'alinea'
import {IcOutlineSettings} from 'alinea/ui/icons/IcOutlineSettings'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'

export const CodeBlock = Config.type('Code', {
  icon: IcOutlineSettings,
  fields: {
    ...Field.tabs(
      Field.tab('Code', {
        icon: IcRoundCode,
        fields: {
          code: Field.code('Code', {inline: true})
        }
      }),
      Field.tab('Settings', {
        icon: IcOutlineSettings,
        fields: {
          fileName: Field.text('File name', {width: 0.75}),
          language: Field.text('Language', {width: 0.25}),
          compact: Field.check('Compact', {description: 'Decrease line height'})
        }
      })
    )
  }
})
