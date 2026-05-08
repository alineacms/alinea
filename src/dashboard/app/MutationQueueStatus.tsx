import {
  Button,
  DialogTrigger,
  Popover,
  ProgressCircle,
  Tooltip
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef, useState, type ReactNode} from 'react'
import {IcRoundCheck, IcRoundWarning} from '../icons.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './MutationQueueStatus.module.css'

const styles = styler(css)

export interface MutationQueueStatusProps {
  ariaLabel?: string
  dashboard: Dashboard
  children?: ReactNode
  placement?: 'top' | 'bottom'
  openOnFail?: boolean
}

export function MutationQueueStatus({
  ariaLabel,
  dashboard,
  children,
  placement = 'top',
  openOnFail = false
}: MutationQueueStatusProps) {
  const queue = useAtomValue(dashboard.mutationQueue)
  const retry = useSetAtom(dashboard.retryMutationQueue)
  const discard = useSetAtom(dashboard.discardMutationQueue)
  const [isOpen, setIsOpen] = useState(false)
  const wasFailed = useRef(false)
  const isFailed = queue.failed > 0
  const isSyncing = queue.entries.length > 0
  const label = isFailed
    ? 'Sync failed'
    : isSyncing
      ? 'Syncing changes'
      : 'Content is up to date'

  useEffect(() => {
    if (openOnFail && isFailed && !wasFailed.current) setIsOpen(true)
    wasFailed.current = isFailed
  }, [isFailed, openOnFail])

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip placement={placement} delay={300} tooltip={label}>
        <Button
          size={children ? undefined : 'icon'}
          appearance={children ? 'outline' : 'plain'}
          className={styles.MutationQueueStatus({
            failed: isFailed,
            syncing: isSyncing
          })}
          aria-label={children ? ariaLabel : label}
        >
          {children ? (
            <span className={styles.MutationQueueStatus.label()}>
              {isFailed ? (
                <IcRoundWarning
                  aria-hidden="true"
                  className={styles.MutationQueueStatus.icon()}
                />
              ) : (
                <ProgressCircle
                  isIndeterminate
                  aria-label={label}
                  className={styles.MutationQueueStatus.icon()}
                />
              )}
              {children}
            </span>
          ) : isSyncing && !isFailed ? (
            <ProgressCircle
              isIndeterminate
              aria-label="Syncing changes"
              className={styles.MutationQueueStatus.icon()}
            />
          ) : isFailed ? (
            <IcRoundWarning
              aria-hidden="true"
              className={styles.MutationQueueStatus.icon()}
            />
          ) : (
            <IcRoundCheck
              aria-hidden="true"
              className={styles.MutationQueueStatus.icon()}
            />
          )}
        </Button>
      </Tooltip>
      <Popover
        className={styles.MutationQueueStatus.popover.surface()}
        placement={placement}
        offset={16}
        style={{
          padding: '0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
        }}
      >
        <div className={styles.MutationQueueStatus.popover()}>
          <div className={styles.MutationQueueStatus.popover.header()}>
            <h2 className={styles.MutationQueueStatus.popover.title()}>
              Sync status
            </h2>
            {isFailed && (
              <div
                className={styles.MutationQueueStatus.popover.actions()}
              >
                <Button
                  size="small"
                  appearance="plain"
                  intent="danger"
                  onPress={() => discard()}
                >
                  Discard
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  intent="danger"
                  onPress={() => retry()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
          {queue.entries.length === 0 && (
            <p className={styles.MutationQueueStatus.popover.message()}>
              All changes are synced.
            </p>
          )}
          {queue.error && (
            <p className={styles.MutationQueueStatus.popover.error()}>
              {queue.error}
            </p>
          )}
          <ul className={styles.MutationQueueStatus.popover.list()}>
            {queue.entries.map(entry => (
              <li
                key={entry.id}
                className={styles.MutationQueueStatus.popover.item()}
              >
                <div
                  className={styles.MutationQueueStatus.popover.item.main()}
                >
                  <span
                    className={styles.MutationQueueStatus.popover.item.title()}
                  >
                    {formatMutationQueueTitle(entry.mutations)}
                  </span>
                  <span
                    className={styles.MutationQueueStatus.popover.item.status(
                      {
                        [entry.status]: true
                      }
                    )}
                  >
                    {formatMutationStatus(entry.status)}
                  </span>
                </div>
                <ul
                  className={styles.MutationQueueStatus.popover.item.ops()}
                >
                  {entry.mutations.map((mutation, index) => (
                    <li
                      key={index}
                      className={styles.MutationQueueStatus.popover.item.op()}
                    >
                      {formatMutation(mutation)}
                    </li>
                  ))}
                </ul>
                {entry.error && (
                  <p
                    className={styles.MutationQueueStatus.popover.item.error()}
                  >
                    {entry.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Popover>
    </DialogTrigger>
  )
}

function formatMutationStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'syncing':
      return 'Syncing'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Waiting'
    default:
      return status
  }
}

function formatMutation(mutation: {
  op: string
  title?: string
  locale?: string | null
  status?: string
  progress?: {loaded: number; total?: number}
}) {
  const progress = mutation.progress
    ? ` ${formatProgress(mutation.progress)}`
    : ''
  const status = mutation.status ? ` ${formatEntryStatus(mutation.status)}` : ''
  const locale = mutation.locale ? ` (${mutation.locale})` : ''
  switch (mutation.op) {
    case 'create':
      return `Saved${status}${locale}`
    case 'update':
      return `Updated${status}${locale}`
    case 'remove':
      return `Deleted${status}${locale}`
    case 'publish':
      return `Published${status}${locale}`
    case 'unpublish':
      return `Unpublished${locale}`
    case 'archive':
      return `Archived${locale}`
    case 'move':
      return 'Moved'
    case 'uploadFile':
      return mutation.progress
        ? `Uploading file${progress}`
        : 'Uploaded file'
    case 'removeFile':
      return 'Removed file'
    default:
      return mutation.op
  }
}

function formatProgress(progress: {loaded: number; total?: number}) {
  if (!progress.total) return formatBytes(progress.loaded)
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((progress.loaded / progress.total) * 100))
  )
  return `${percentage}%`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

function formatMutationQueueTitle(
  mutations: Array<{
    title?: string
    op: string
  }>
) {
  const titles = [
    ...new Set(mutations.map(mutation => mutation.title).filter(isString))
  ]
  if (titles.length === 1) return titles[0]
  if (titles.length > 1) return `${titles.length} entries`
  if (mutations.some(mutation => mutation.op === 'uploadFile')) return 'File'
  return 'Content changes'
}

function formatEntryStatus(status: string) {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'published':
      return 'published version'
    case 'archived':
      return 'archived version'
    default:
      return status
  }
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string'
}
