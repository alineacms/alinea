import {useDashboardContext} from '../hooks.js'

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 *
 * @deprecated Use `useLocale` from 'alinea/cms'.
 */
export function useLocale(): string | null {
  return useDashboardContext().page.locale
}
