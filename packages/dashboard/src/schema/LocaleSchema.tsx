import {type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {IcRoundLanguage} from '@alinea/ui/icons/IcRoundLanguage'

export const LocaleSchema = {
  Locale: type('Locale', {
    title: text('Title', {help: 'The title of the locale', width: 0.5}),
    path: text('Locale identifier', {
      help: 'A unique identifier that is included in urls',
      width: 0.5
    })
  }).configure({
    isContainer: true,
    icon: IcRoundLanguage
  })
}
