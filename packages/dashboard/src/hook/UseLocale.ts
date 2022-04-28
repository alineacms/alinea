import {useMemo} from 'react'
import {useLocation} from 'react-router'
import {parseRootPath, useRoot} from './UseRoot'

export function useLocale(): string | undefined {
  const location = useLocation()
  const root = useRoot()
  return useMemo(() => {
    const {i18n} = root
    if (!i18n) return
    const path = location.pathname.split('/')[2]
    if (path) {
      const fromUrl = parseRootPath(path)[1]
      if (fromUrl && i18n.locales.includes(fromUrl)) return fromUrl
    }
    return root.defaultLocale
  }, [root, location.pathname])
}
