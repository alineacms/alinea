import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Checkbox
} from '#/components.js'
import {memo} from 'react'
import {IcRoundTranslate} from '../icons.js'
import {LocaleMenuSelect} from './LocaleMenu.js'

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
    <Alert
      variant={parentNeedsTranslation ? 'warning' : 'default'}
      icon={IcRoundTranslate}
    >
      <AlertTitle>This entry has not been translated yet</AlertTitle>
      {parentNeedsTranslation ? (
        <AlertDescription>
          Translate the parent entry first before creating this translation.
        </AlertDescription>
      ) : (
        <AlertActions>
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
        </AlertActions>
      )}
    </Alert>
  )
})
