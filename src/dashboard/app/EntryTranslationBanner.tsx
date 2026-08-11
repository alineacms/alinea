import {Select, SelectItem, Surface} from '#/components.js'
import {styler} from '@alinea/styler'
import {memo} from 'react'
import css from './EntryTranslationBanner.module.css'

const styles = styler(css)

export interface EntryTranslationBannerProps {
  parentNeedsTranslation: boolean
  sourceLocale: string | null
  sourceLocales: ReadonlyArray<string>
  onSourceLocaleChange: (locale: string) => void
}

export const EntryTranslationBanner = memo(function EntryTranslationBanner({
  parentNeedsTranslation,
  sourceLocale,
  sourceLocales,
  onSourceLocaleChange
}: EntryTranslationBannerProps) {
  return (
    <Surface className={styles.EntryTranslationBanner()}>
      <div className={styles.EntryTranslationBanner.body()}>
        <p className={styles.EntryTranslationBanner.title()}>
          This entry has not been translated yet
        </p>
        <p className={styles.EntryTranslationBanner.message()}>
          {parentNeedsTranslation
            ? 'Translate the parent entry first before creating this translation.'
            : 'Choose the existing language to copy from before creating the translation.'}
        </p>
      </div>
      {!parentNeedsTranslation && sourceLocale && (
        <div className={styles.EntryTranslationBanner.actions()}>
          <span className={styles.EntryTranslationBanner.label()}>
            Start from
          </span>
          <Select
            aria-label="Translation source language"
            className={styles.EntryTranslationBanner.select()}
            selectedKey={sourceLocale}
            onSelectionChange={key => {
              if (key) onSourceLocaleChange(String(key))
            }}
          >
            {sourceLocales.map(locale => (
              <SelectItem key={locale} id={locale}>
                {locale.toUpperCase()}
              </SelectItem>
            ))}
          </Select>
        </div>
      )}
    </Surface>
  )
})
