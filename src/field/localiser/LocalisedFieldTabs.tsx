import {Tabs, TabsContent, TabsList, TabsTrigger} from '#/components.js'
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
      value={selectedLocale}
      onValueChange={onSelectedLocaleChange}
      className={styles.LocalisedFieldTabs()}
    >
      <TabsList>
        {locales.map(locale => (
          <TabsTrigger value={locale} key={locale}>
            {locale.toUpperCase()}
          </TabsTrigger>
        ))}
      </TabsList>
      {locales.map(locale => (
        <TabsContent value={locale} key={locale}>
          {children(locale)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
