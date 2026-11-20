import {
  List,
  ListItem,
  ListItemStatus,
  ListItemTitle,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '#/components.js'
import type {EntryStatus} from '#/core/Entry.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {useState} from 'react'
import type {EntryAtoms} from '../atoms/entry.js'
import {routeAtom} from '../atoms/nav.js'
import {IcRoundLanguage} from '../icons.js'
import css from './EntryTranslations.module.css'
import {localeDisplay} from './LocaleMenu.js'

const styles = styler(css)

const statusLabel = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived'
}

const statusColor = {
  published: 'success',
  draft: 'warning',
  archived: 'muted'
} as const

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
  const [open, setOpen] = useState(false)
  if (translations.length < 2) return null
  const total = translations.length
  const translated = translations.filter(item => item.status).length
  function select(next: string) {
    setOpen(false)
    setRoute({workspace, root, entry: entry.id, locale: next, view: route.view})
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        variant="ghost"
        size="sm"
        icon={IcRoundLanguage}
        aria-label={`Translated in ${translated} of ${total} languages`}
      >
        {translated}/{total}
      </PopoverTrigger>
      <PopoverContent aria-label="Languages" side="bottom" align="start">
        <List className={styles.EntryTranslations()}>
          {translations.map(item => (
            <ListItem
              key={item.locale}
              selected={item.locale === locale}
              onClick={() => select(item.locale)}
              trailing={<EntryTranslationStatus status={item.status} />}
            >
              <ListItemTitle>{localeDisplay(item.locale).name}</ListItemTitle>
            </ListItem>
          ))}
        </List>
      </PopoverContent>
    </Popover>
  )
}

interface EntryTranslationStatusProps {
  status?: EntryStatus
}

function EntryTranslationStatus({status}: EntryTranslationStatusProps) {
  if (!status) return <ListItemStatus color="muted">Translate</ListItemStatus>
  return (
    <ListItemStatus color={statusColor[status]}>
      {statusLabel[status]}
    </ListItemStatus>
  )
}
