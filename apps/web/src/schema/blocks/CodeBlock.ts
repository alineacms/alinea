import alinea from 'alinea'
import {IcOutlineSettings} from 'alinea/ui/icons/IcOutlineSettings'
import {IcRoundCode} from 'alinea/ui/icons/IcRoundCode'

export const CodeBlock = alinea.type('Code', {
  ...alinea.tabs(
    alinea.tab('Code', {
      code: alinea.code('Code', {inline: true}),
      [alinea.tab.meta]: {
        icon: IcRoundCode
      }
    }),
    alinea.tab('Settings', {
      fileName: alinea.text('File name', {width: 0.75}),
      language: alinea.text('Language', {width: 0.25}),
      compact: alinea.check('Compact', {label: 'Decrease line height'}),
      [alinea.tab.meta]: {
        icon: IcOutlineSettings
      }
    })
  ),
  [alinea.type.meta]: {
    icon: IcOutlineSettings
  }
})
