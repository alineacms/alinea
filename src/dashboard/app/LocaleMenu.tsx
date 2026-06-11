import {Icon, Menu, MenuItem} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {Button} from 'react-aria-components'
import {IcRoundUnfoldMore} from '../icons.js'
import type {
  DashboardLocaleSelection,
  DashboardRoot
} from '../store/Dashboard.js'
import css from './LocaleMenu.module.css'

const styles = styler(css)

interface LocaleMenuProps {
  root: DashboardRoot
  selectedLocale?: DashboardLocaleSelection
}

interface LocaleDisplay {
  code: string | null
  name: string
  textValue: string
}

interface LocaleLabelProps {
  locale: string
}

function localeDisplay(locale: string): LocaleDisplay {
  let parsed: Intl.Locale
  try {
    parsed = new Intl.Locale(locale)
  } catch {
    return {code: null, name: locale, textValue: locale}
  }
  const languages = new Intl.DisplayNames(undefined, {type: 'language'})
  const language = languages.of(parsed.language)
  const code = locale.toUpperCase()
  if (!language) return {code: null, name: locale, textValue: locale}
  if (!parsed.region) {
    return {code, name: language, textValue: `${code} ${language}`}
  }
  const regions = new Intl.DisplayNames(undefined, {type: 'region'})
  const region = regions.of(parsed.region)
  const name = region ? `${language} (${region})` : language
  return {code, name, textValue: `${code} ${name}`}
}

function LocaleLabel({locale}: LocaleLabelProps) {
  const display = localeDisplay(locale)
  if (!display.code) {
    return <span className={styles.LocaleMenu.label()}>{display.name}</span>
  }
  return (
    <span className={styles.LocaleMenu.label()}>
      <span className={styles.LocaleMenu.label.code()}>{display.code}</span>
      <span className={styles.LocaleMenu.label.fullName()}>{display.name}</span>
    </span>
  )
}

export function LocaleMenu({
  root,
  selectedLocale: selectedLocaleAtom = root.selectedLocale
}: LocaleMenuProps) {
  const i18n = useAtomValue(root.i18n)
  const [selectedLocale, setSelectedLocale] = useAtom(selectedLocaleAtom)
  if (!i18n || i18n.locales.length === 0) return null
  const activeLocale = selectedLocale ?? i18n.locales[0]
  if (!activeLocale) return null
  return (
    <Menu
      label={
        <Button className={styles.LocaleMenu.trigger()}>
          <LocaleLabel locale={activeLocale} />
          <Icon
            icon={IcRoundUnfoldMore}
            className={styles.LocaleMenu.trigger.icon()}
          />
        </Button>
      }
      aria-label="Language"
      popoverProps={{placement: 'bottom right'}}
      selectionMode="single"
      selectedKeys={[activeLocale]}
      onAction={key => {
        setSelectedLocale(String(key))
      }}
    >
      {i18n.locales.map(locale => {
        const label = localeDisplay(locale).textValue
        return (
          <MenuItem key={locale} id={locale} textValue={label}>
            <LocaleLabel locale={locale} />
          </MenuItem>
        )
      })}
    </Menu>
  )
}
