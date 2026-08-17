import {Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {styler} from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './LocalisedFieldTabs.module.css'

const styles = styler(css)

export interface LocalisedFieldTabsProps {
  locales: ReadonlyArray<string>
  selectedLocale: string
  onSelectedLocaleChange(locale: string): void
  children(locale: string): ReactNode
}

export function LocalisedFieldTabs({
  locales,
  selectedLocale,
  onSelectedLocaleChange,
  children
}: LocalisedFieldTabsProps) {
  return (
    <Tabs
      selectedKey={selectedLocale}
      onSelectionChange={key => onSelectedLocaleChange(String(key))}
      className={styles.LocalisedFieldTabs()}
    >
      <TabList>
        {locales.map(locale => (
          <Tab id={locale} key={locale}>
            {locale.toUpperCase()}
          </Tab>
        ))}
      </TabList>
      {locales.map(locale => (
        <TabPanel id={locale} key={locale}>
          {children(locale)}
        </TabPanel>
      ))}
    </Tabs>
  )
}
