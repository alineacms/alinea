import {useAtomValue, useSetAtom} from 'jotai'
import {
  languagePreferenceAtom,
  preferencesAtom,
  schemePreferenceAtom,
  sizePreferenceAtom,
  toggleSchemePreferenceAtom,
  workspacePreferenceAtom
} from '../atoms/PreferencesAtoms.js'

export const usePreferences = () => useAtomValue(preferencesAtom)
export const useSchemePreference = () => useAtomValue(schemePreferenceAtom)
export const useToggleSchemePreference = () =>
  useSetAtom(toggleSchemePreferenceAtom)
export const useWorkspacePreference = () =>
  useAtomValue(workspacePreferenceAtom)
export const useSizePreference = () => useAtomValue(sizePreferenceAtom)
export const useLanguagePreference = () => useAtomValue(languagePreferenceAtom)
