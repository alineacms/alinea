import {en} from 'alinea/translations'
import {atom} from 'jotai'
import {configAtom} from './DashboardAtoms.js'

export const translationAtom = atom(get => {
  const config = get(configAtom)
  const languages = config.interfaceLanguages ?? {en}
  const available = Object.keys(languages)
  return languages[available[0]]
})
