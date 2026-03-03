import {Button, Menu, MenuItem} from '@alinea/components'

interface LocaleMenuProps {
  locales: Array<string>
  selectedLocale: string | undefined
  onSelectLocale: (locale: string) => void
}

export function LocaleMenu({
  locales,
  selectedLocale,
  onSelectLocale
}: LocaleMenuProps) {
  if (locales.length <= 1 || !selectedLocale) return null
  return (
    <Menu
      label={<Button appearance="plain">{selectedLocale.toUpperCase()}</Button>}
      aria-label="Language"
      selectionMode="single"
      selectedKeys={new Set([selectedLocale])}
      onAction={function onAction(key) {
        if (!key) return
        onSelectLocale(String(key))
      }}
    >
      {locales.map(locale => (
        <MenuItem
          key={locale}
          id={locale}
        >
          {locale.toUpperCase()}
        </MenuItem>
      ))}
    </Menu>
  )
}
