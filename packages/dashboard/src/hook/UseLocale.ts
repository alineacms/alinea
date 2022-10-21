import {outcome} from '@alinea/core'
import {useMatch} from '@alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav'
import {parseRootPath, useRoot} from './UseRoot'

const nav = dashboardNav({})

export function useLocale(): string | undefined {
  const root = useRoot()
  const [match] = outcome(() => useMatch(nav.matchRoot))
  return useMemo(() => {
    const {i18n} = root
    if (!i18n) return
    const params: Record<string, string | undefined> = match ?? {}
    const {root: rootKey} = params
    if (rootKey) {
      const fromUrl = parseRootPath(rootKey)[1]
      if (fromUrl && i18n.locales.includes(fromUrl)) return fromUrl
    }
    return root.defaultLocale
  }, [root, match])
}
