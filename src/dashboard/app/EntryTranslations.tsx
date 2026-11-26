import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import type {EntryAtoms} from '../atoms/entry.js'
import {routeAtom} from '../atoms/nav.js'
import {IcRoundLanguage} from '../icons.js'
import css from './EntryTranslations.module.css'
import {LocaleLabel, localeDisplay} from './LocaleMenu.js'

const styles = styler(css)

const statusLabel = {
  published: 'Published',
  draft: 'Draft',
  unpublished: 'Unpublished',
  archived: 'Archived',
  untranslated: 'Untranslated'
}

export interface EntryTranslationsProps {
  entry: EntryAtoms
  locale: string | null
}

export function EntryTranslations({entry, locale}: EntryTranslationsProps) {
  const translations = useAtomValueRaw(entry.translations)
  const workspace = useAtomValueRaw(entry.workspace)
  const root = useAtomValueRaw(entry.root)
  const route = useAtomValueRaw(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  if (translations.length < 2) return null
  const total = translations.length
  const translated = translations.filter(
    item => item.status && item.status !== 'archived'
  ).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant="ghost"
        size="sm"
        icon={IcRoundLanguage}
        aria-label={`Translated in ${translated} of ${total} languages`}
      >
        {translated}/{total}
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Languages" side="bottom" align="start">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={next =>
            setRoute({
              workspace,
              root,
              entry: entry.id,
              locale: next,
              view: route.view
            })
          }
        >
          {translations.map(item => {
            const status = item.status ?? 'untranslated'
            return (
              <DropdownMenuRadioItem
                key={item.locale}
                value={item.locale}
                textValue={localeDisplay(item.locale).textValue}
              >
                {/* The label takes the free space so the badges line up */}
                <span className={styles.EntryTranslations.locale()}>
                  <LocaleLabel locale={item.locale} />
                </span>
                <Badge size="sm" status={status}>
                  {statusLabel[status]}
                </Badge>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
