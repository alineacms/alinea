import {Select, SelectItem} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {DashboardEntry} from '../store/Dashboard.js'
import css from './EntryTranslationBanner.module.css'

const styles = styler(css)

export interface EntryTranslationBannerProps {
  entry: DashboardEntry
}

export function EntryTranslationBanner({
  entry
}: EntryTranslationBannerProps) {
  const untranslated = useAtomValue(entry.untranslated)
  const parentNeedsTranslation = useAtomValue(entry.parentNeedsTranslation)
  const sourceLocales = useAtomValue(entry.translationSourceLocales)
  const [sourceLocale, setSourceLocale] = useAtom(entry.translationSourceLocale)

  if (!untranslated) return null

  return (
    <div className={styles.EntryTranslationBanner()}>
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
              if (key) setSourceLocale(String(key))
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
    </div>
  )
}
