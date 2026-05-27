import {Button, Icon, ProgressCircle} from '#/components.js'
import type {EntryStatus} from '#/core/Entry.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {
  IcRoundImage,
  IcRoundInsertDriveFile,
  IcRoundLink
} from '../icons.js'
import type {
  DashboardEntryData,
  DashboardEntryReference,
  DashboardEntryReferencesState,
  DashboardEntryReferenceSource
} from '../store.js'
import {Badge} from './Badge.js'
import css from './EntryReferences.module.css'

const styles = styler(css)

export interface EntryReferencesProps {
  entry: DashboardEntryData
}

export function EntryReferences({entry}: EntryReferencesProps) {
  const state = useAtomValue(entry.incomingReferencesState)
  const root = useAtomValue(entry.root)
  const selectedLocale = useAtomValue(root.selectedLocale)
  const setRoute = useSetAtom(entry.dashboard.route)
  if (state.pending && state.data === undefined)
    return <EntryReferencesLoading state={state} />
  const references = state.data?.references ?? []
  const currentReferences = references.filter(item =>
    matchesLocale(item, selectedLocale)
  )
  const otherReferences = references.filter(
    item => !matchesLocale(item, selectedLocale)
  )
  const groups = groupReferences(currentReferences)
  const otherGroups = groupReferences(otherReferences)
  const otherSummary = formatOtherLocales(otherGroups)
  if (groups.length === 0) {
    return (
      <div className={styles.EntryReferences()}>
        <p className={styles.EntryReferences.empty()}>
          {state.pending
            ? formatScan(state.scan)
            : formatEmpty(selectedLocale, otherSummary)}
        </p>
        {otherSummary && (
          <p className={styles.EntryReferences.other()}>
            {formatOtherSummary(otherSummary)}
          </p>
        )}
      </div>
    )
  }
  return (
    <div className={styles.EntryReferences()}>
      {state.pending && (
        <div className={styles.EntryReferences.pending()}>
          <ProgressCircle isIndeterminate aria-label="Scanning references" />
          <span className={styles.EntryReferences.pendingText()}>
            {formatScan(state.scan)}
          </span>
        </div>
      )}
      <ul className={styles.EntryReferences.list()}>
        {groups.map(item => (
          <EntryReferenceItem
            item={item}
            key={item.key}
            onPress={() => {
              setRoute({
                workspace: item.source.workspace,
                root: item.source.root,
                entry: item.source.id,
                locale: item.locale ?? undefined
              })
            }}
          />
        ))}
      </ul>
      {otherSummary && (
        <p className={styles.EntryReferences.other()}>
          {formatOtherSummary(otherSummary)}
        </p>
      )}
    </div>
  )
}

interface EntryReferencesLoadingProps {
  state: DashboardEntryReferencesState
}

function EntryReferencesLoading({state}: EntryReferencesLoadingProps) {
  return (
    <div className={styles.EntryReferences.loading()}>
      <ProgressCircle isIndeterminate aria-label="Loading references" />
      <span className={styles.EntryReferences.loadingText()}>
        {formatScan(state.scan)}
      </span>
    </div>
  )
}

interface EntryReferenceItemProps {
  item: EntryReferenceGroup
  onPress: () => void
}

function EntryReferenceItem({item, onPress}: EntryReferenceItemProps) {
  const {linkType, source} = item
  return (
    <li className={styles.EntryReferences.item()}>
      <Button
        appearance="outline"
        className={styles.EntryReferences.button()}
        onPress={onPress}
        aria-label={`Open ${source.title}`}
      >
        <span className={styles.EntryReferences.icon()}>
          <Icon icon={referenceIcon(linkType)} />
        </span>
        <span className={styles.EntryReferences.content()}>
          <span className={styles.EntryReferences.title()}>{source.title}</span>
          <span className={styles.EntryReferences.meta()}>
            {formatFields(item.fields)}
          </span>
          <span className={styles.EntryReferences.statusLine()}>
            <span className={styles.EntryReferences.path()}>{source.path}</span>
            {item.locale && (
              <span className={styles.EntryReferences.locale()}>
                {formatLocale(item.locale)}
              </span>
            )}
            {item.statuses.map(status => (
              <Badge
                appearance="default"
                className={styles.EntryReferences.status()}
                key={status}
                status={badgeStatus(status)}
              >
                {statusLabel(status)}
              </Badge>
            ))}
          </span>
        </span>
      </Button>
    </li>
  )
}

interface EntryReferenceGroup {
  key: string
  source: DashboardEntryReferenceSource
  locale: string | null
  fields: Array<string>
  statuses: Array<EntryStatus>
  linkType: DashboardEntryReference['reference']['linkType']
}

function groupReferences(
  references: Array<DashboardEntryReference>
): Array<EntryReferenceGroup> {
  const groups = new Map<string, EntryReferenceGroup>()
  for (const item of references) {
    const {reference, source} = item
    const locale = reference.sourceLocale
    const key = `${source.workspace}\0${source.root}\0${source.id}\0${locale ?? ''}`
    const field = reference.fieldLabel ?? reference.fieldPath
    const group = groups.get(key)
    if (group) {
      if (!group.fields.includes(field)) group.fields.push(field)
      if (!group.statuses.includes(reference.sourceStatus)) {
        group.statuses.push(reference.sourceStatus)
        group.statuses.sort(compareStatuses)
      }
      group.linkType ??= reference.linkType
      continue
    }
    groups.set(key, {
      key,
      source,
      locale,
      fields: [field],
      statuses: [reference.sourceStatus],
      linkType: reference.linkType
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
  item: DashboardEntryReference,
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

function referenceIcon(
  linkType: DashboardEntryReference['reference']['linkType']
) {
  switch (linkType) {
    case 'image':
      return IcRoundImage
    case 'file':
      return IcRoundInsertDriveFile
    default:
      return IcRoundLink
  }
}

function formatScan(scan: DashboardEntryReferencesState['scan']): string {
  if (!scan) return 'Scanning references'
  if (scan.complete) return `Scanned ${scan.scanned} entries`
  return `Scanning references ${scan.scanned} of ${scan.total}`
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
  if (!otherSummary) return 'No incoming references'
  return `No incoming references in ${formatSelectedLocale(selectedLocale)}`
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

function badgeStatus(status: EntryStatus) {
  switch (status) {
    case 'published':
      return 'success'
    case 'draft':
      return 'warning'
    case 'archived':
      return 'neutral'
  }
}
