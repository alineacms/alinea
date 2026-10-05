import {useAtomValueRaw, useSetAtom} from 'jotai'
import {dashboardMobileAtom} from '../atoms/dashboard.js'
import {routeAtom} from '../atoms/nav.js'
import {useDashboardContext} from '../hooks.js'
import {LocaleMenu} from './LocaleMenu.js'

/** The tree holds the locale menu, on mobile the tree is hidden */
export function HeaderLocaleMenu() {
  const isMobile = useAtomValueRaw(dashboardMobileAtom)
  const {page, root} = useDashboardContext()
  const setRoute = useSetAtom(routeAtom)
  if (!isMobile) return null
  return (
    <LocaleMenu
      root={root}
      locale={page.locale}
      onLocaleChange={locale =>
        setRoute({
          workspace: root.workspace,
          root: root.key,
          entry: page.entry,
          locale
        })
      }
    />
  )
}
