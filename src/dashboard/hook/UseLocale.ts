import {useDashboardContext} from '../hooks.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useLocale(): string | null {
  return useDashboardContext().page.locale
}
