import {dispense} from '#/dashboard/atoms/utils.js'
import {atom} from 'jotai'
import {selectLocale} from './SelectLocale.js'

interface LocalisedFieldTabPick {
  scope: string
  locale: string
}

/**
 * The tab last picked by the user, shared by the localised fields that use
 * the same set of locales so they switch together.
 */
const pickedTab = dispense((_locales: ReadonlyArray<string>) =>
  atom<LocalisedFieldTabPick | undefined>(undefined)
)

/**
 * The selected tab of a localised field. It opens on the locale being edited
 * (or the first locale if the field does not have it). A tab the user picks
 * sticks while editing the same entry in the same locale; opening another
 * entry or switching the entry locale follows the edited locale again.
 */
export const localisedFieldTab = dispense(
  (
    locales: ReadonlyArray<string>,
    entryId: string | null,
    editingLocale: string | null
  ) => {
    const scope = `${entryId ?? ''}\0${editingLocale ?? ''}`
    return atom(
      get => {
        const picked = get(pickedTab(locales))
        if (picked?.scope === scope && locales.includes(picked.locale))
          return picked.locale
        return selectLocale(editingLocale, locales)
      },
      (_get, set, locale: string) => {
        set(pickedTab(locales), {scope, locale})
      }
    )
  }
)
