import {Checkbox, Surface} from '#/components.js'
import {styler} from '@alinea/styler'
import {memo} from 'react'
import css from './EntryTranslationBanner.module.css'
import {LocaleMenuSelect} from './LocaleMenu.js'

const styles = styler(css)

export interface EntryTranslationBannerProps {
  copyFromSource: boolean
  parentNeedsTranslation: boolean
  sourceLocale: string | null
  sourceLocales: ReadonlyArray<string>
  onCopyFromSourceChange: (copyFromSource: boolean) => void
  onSourceLocaleChange: (locale: string) => void
}

export const EntryTranslationBanner = memo(function EntryTranslationBanner({
  copyFromSource,
  parentNeedsTranslation,
  sourceLocale,
  sourceLocales,
  onCopyFromSourceChange,
  onSourceLocaleChange
}: EntryTranslationBannerProps) {
  return (
    <Surface className={styles.EntryTranslationBanner()}>
      <div className={styles.EntryTranslationBanner.body()}>
        <p className={styles.EntryTranslationBanner.title()}>
          This entry has not been translated yet
        </p>
        {(parentNeedsTranslation || !copyFromSource) && (
          <p className={styles.EntryTranslationBanner.message()}>
            {parentNeedsTranslation &&
              'Translate the parent entry first before creating this translation.'}
          </p>
        )}
      </div>
      {!parentNeedsTranslation && (
        <div className={styles.EntryTranslationBanner.actions()}>
          <Checkbox
            checked={copyFromSource}
            onCheckedChange={onCopyFromSourceChange}
          >
            Copy from existing translation
          </Checkbox>
          {copyFromSource && sourceLocale && (
            <LocaleMenuSelect
              ariaLabel="Translation source language"
              locale={sourceLocale}
              locales={sourceLocales}
              onLocaleChange={onSourceLocaleChange}
            />
          )}
        </div>
      )}
    </Surface>
  )
})
