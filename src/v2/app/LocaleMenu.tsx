import {Button, Menu, MenuItem} from '@alinea/components'
import {useAtom, useAtomValue} from 'jotai'
import {DashboardRoot} from '../dashboard/Dashboard.js'

interface LocaleMenuProps {
  root: DashboardRoot
}

export function LocaleMenu({root}: LocaleMenuProps) {
  const i18n = useAtomValue(root.i18n)
  const [selectedLocale, setSelectedLocale] = useAtom(root.selectedLocale)
  if (!i18n || !selectedLocale) return null
  return (
    <Menu
      label={<Button appearance="plain">{selectedLocale.toUpperCase()}</Button>}
      aria-label="Language"
      selectionMode="single"
      selectedKeys={new Set([selectedLocale])}
      onAction={key => {
        setSelectedLocale(String(key))
      }}
    >
      {i18n.locales.map(locale => (
        <MenuItem key={locale} id={locale}>
          {locale.toUpperCase()}
        </MenuItem>
      ))}
    </Menu>
  )
}
