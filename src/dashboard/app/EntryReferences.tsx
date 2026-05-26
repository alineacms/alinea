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
  DashboardEntryReferencesState
} from '../store.js'
import css from './EntryReferences.module.css'

const styles = styler(css)

export interface EntryReferencesProps {
  entry: DashboardEntryData
}

export function EntryReferences({entry}: EntryReferencesProps) {
  const state = useAtomValue(entry.incomingReferencesState)
  const setRoute = useSetAtom(entry.dashboard.route)
  if (state.pending && state.data === undefined)
    return <EntryReferencesLoading state={state} />
  const references = state.data?.references ?? []
  if (references.length === 0) {
    return (
      <div className={styles.EntryReferences()}>
        <p className={styles.EntryReferences.empty()}>
          {state.pending ? formatScan(state.scan) : 'No incoming references'}
        </p>
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
        {references.map(item => (
          <EntryReferenceItem
            item={item}
            key={`${item.reference.sourceFilePath}:${item.reference.fieldPath}:${item.reference.linkId ?? ''}`}
            onPress={() => {
              setRoute({
                workspace: item.source.workspace,
                root: item.source.root,
                entry: item.source.id,
                locale: item.source.locale ?? undefined
              })
            }}
          />
        ))}
      </ul>
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
  item: DashboardEntryReference
  onPress: () => void
}

function EntryReferenceItem({item, onPress}: EntryReferenceItemProps) {
  const {reference, source} = item
  return (
    <li className={styles.EntryReferences.item()}>
      <Button
        appearance="outline"
        className={styles.EntryReferences.button()}
        onPress={onPress}
        aria-label={`Open ${source.title}`}
      >
        <span className={styles.EntryReferences.icon()}>
          <Icon icon={referenceIcon(reference.linkType)} />
        </span>
        <span className={styles.EntryReferences.content()}>
          <span className={styles.EntryReferences.title()}>{source.title}</span>
          <span className={styles.EntryReferences.meta()}>
            {reference.fieldLabel ?? reference.fieldPath}
          </span>
          <span className={styles.EntryReferences.path()}>
            {entryPath(source.path, source.status)}
          </span>
        </span>
      </Button>
    </li>
  )
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

function entryPath(path: string, status: EntryStatus): string {
  return status === 'published' ? path : `${path} (${status})`
}
