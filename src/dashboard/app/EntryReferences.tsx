import {
  Icon,
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual,
  Text
} from '#/components.js'
import type {EntryStatus} from '#/core/Entry.js'
import type {
  EntryAtoms,
  EntryLocaleAtoms,
  EntryReferenceSource,
  EntryReferenceWithSource
} from '#/dashboard/atoms/entry.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {IcRoundLink, LucideFile} from '../icons.js'
import css from './EntryReferences.module.css'

const styles = styler(css)

export interface EntryReferencesProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
}

export function EntryReferences({entry, localeData}: EntryReferencesProps) {
  const data = useAtomValueRawSync(entry.incomingReferences)
  const setRoute = useSetAtom(routeAtom)
  if (!data) return null
  return (
    <div className={styles.EntryReferences.tab()}>
      <EntryReferenceList
        references={data.references}
        locale={localeData.requestedLocale}
        onSelect={(source, locale) => {
          setRoute({
            workspace: source.workspace,
            root: source.root,
            entry: source.id,
            locale: locale ?? undefined
          })
        }}
      />
    </div>
  )
}

export interface EntryReferenceListProps {
  references: Array<EntryReferenceWithSource>
  /** The locale being edited, null for entries without languages */
  locale: string | null
  onSelect(source: EntryReferenceSource, locale: string | null): void
  /** The most linking entries to list */
  limit?: number
}

/** The number of entries linking, counting each language */
export function countReferenceSources(
  references: Array<EntryReferenceWithSource>
): number {
  return groupReferences(references).length
}

/** The entries linking to an entry, grouped per entry and language */
export function EntryReferenceList({
  references,
  locale,
  onSelect,
  limit
}: EntryReferenceListProps) {
  // Entries in roots without languages (such as media) can be referenced
  // from any locale
  const showAllLocales = locale === null
  const currentReferences = showAllLocales
    ? references
    : references.filter(item => matchesLocale(item, locale))
  const otherReferences = showAllLocales
    ? []
    : references.filter(item => !matchesLocale(item, locale))
  const groups = groupReferences(currentReferences).slice(0, limit)
  const otherSummary = formatOtherLocales(groupReferences(otherReferences))
  if (groups.length === 0) {
    return (
      <div className={styles.EntryReferences()}>
        <List aria-label="References" empty>
          <ListEmpty icon={IcRoundLink} title="No references">
            {formatEmpty(locale, otherSummary)}
          </ListEmpty>
        </List>
        {otherSummary && (
          <Text as="p" size="sm" color="muted">
            {formatOtherSummary(otherSummary)}
          </Text>
        )}
      </div>
    )
  }
  return (
    <div className={styles.EntryReferences()}>
      <List aria-label="References" className={styles.EntryReferences.list()}>
        {groups.map(item => (
          <EntryReferenceItem
            item={item}
            key={item.key}
            onClick={() => onSelect(item.source, item.locale)}
          />
        ))}
      </List>
      {otherSummary && (
        <Text as="p" size="sm" color="muted">
          {formatOtherSummary(otherSummary)}
        </Text>
      )}
    </div>
  )
}

interface EntryReferenceItemProps {
  item: EntryReferenceGroup
  onClick: () => void
}

function EntryReferenceItem({item, onClick}: EntryReferenceItemProps) {
  const {source} = item
  const typeIcon = useAtomValueRaw(typeAtoms(source.type)).icon
  return (
    <ListItem
      leading={
        <ListItemVisual>
          <Icon icon={typeIcon ?? LucideFile} />
        </ListItemVisual>
      }
      onClick={onClick}
      trailing={
        <span className={styles.EntryReferences.trailing()}>
          {item.statuses.map(status => (
            <ListItemStatus key={status} color={statusColor(status)}>
              {statusLabel(status)}
            </ListItemStatus>
          ))}
        </span>
      }
    >
      <ListItemTitle>{source.title}</ListItemTitle>
      <ListItemDescription>
        {formatFields(item.fields)} · {source.path}
        {item.locale && ` · ${formatLocale(item.locale)}`}
      </ListItemDescription>
    </ListItem>
  )
}

interface EntryReferenceGroup {
  key: string
  source: EntryReferenceSource
  locale: string | null
  fields: Array<string>
  statuses: Array<EntryStatus>
}

function groupReferences(
  references: Array<EntryReferenceWithSource>
): Array<EntryReferenceGroup> {
  const groups = new Map<string, EntryReferenceGroup>()
  for (const item of references) {
    const {reference, source} = item
    const locale = reference.sourceLocale
    const key = `${source.workspace}\0${source.root}\0${source.id}\0${locale ?? ''}`
    const field = formatFieldLabels(reference)
    const group = groups.get(key)
    if (group) {
      if (!group.fields.includes(field)) group.fields.push(field)
      if (!group.statuses.includes(reference.sourceStatus)) {
        group.statuses.push(reference.sourceStatus)
        group.statuses.sort(compareStatuses)
      }
      continue
    }
    groups.set(key, {
      key,
      source,
      locale,
      fields: [field],
      statuses: [reference.sourceStatus]
    })
  }
  return Array.from(groups.values())
}

interface OtherLocaleSummary {
  count: number
  locales: Array<OtherLocaleCount>
}

interface OtherLocaleCount {
  locale: string | null
  count: number
}

function matchesLocale(
  item: EntryReferenceWithSource,
  selectedLocale: string | null
): boolean {
  return item.reference.sourceLocale === selectedLocale
}

function formatOtherLocales(
  groups: Array<EntryReferenceGroup>
): OtherLocaleSummary | undefined {
  if (groups.length === 0) return undefined
  const locales = new Map<string | null, number>()
  for (const group of groups) {
    locales.set(group.locale, (locales.get(group.locale) ?? 0) + 1)
  }
  return {
    count: groups.length,
    locales: Array.from(locales, ([locale, count]) => ({locale, count}))
  }
}

/** The labels of the fields leading to the reference, eg. "Metadata › Open
 * Graph › Image" */
function formatFieldLabels(
  reference: EntryReferenceWithSource['reference']
): string {
  if (reference.fieldLabels?.length) return reference.fieldLabels.join(' › ')
  return reference.fieldLabel ?? reference.fieldPath
}

function statusLabel(status: EntryStatus): string {
  return status[0].toUpperCase() + status.slice(1)
}

function formatFields(fields: Array<string>): string {
  return fields.join(', ')
}

function formatEmpty(
  selectedLocale: string | null,
  otherSummary: OtherLocaleSummary | undefined
): string {
  if (!otherSummary) return 'This entry is not referenced anywhere'
  return `This entry is not referenced in ${formatSelectedLocale(selectedLocale)}`
}

function formatOtherSummary(summary: OtherLocaleSummary): string {
  return `${formatCount(summary.count)} in other languages: ${summary.locales
    .map(formatLocaleCount)
    .join(', ')}`
}

function formatLocaleCount(locale: OtherLocaleCount): string {
  return `${formatSelectedLocale(locale.locale)} (${locale.count})`
}

function formatCount(count: number): string {
  return `${count} ${count === 1 ? 'reference' : 'references'}`
}

function formatSelectedLocale(locale: string | null): string {
  return locale ? formatLocale(locale) : 'default language'
}

function formatLocale(locale: string): string {
  return locale.toUpperCase()
}

function compareStatuses(a: EntryStatus, b: EntryStatus): number {
  return statusOrder(a) - statusOrder(b)
}

function statusOrder(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}

function statusColor(status: EntryStatus) {
  switch (status) {
    case 'published':
      return 'success' as const
    case 'draft':
      return 'primary' as const
    case 'archived':
      return 'muted' as const
  }
}
