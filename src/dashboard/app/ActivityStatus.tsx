import {
  Button,
  DialogTrigger,
  Icon,
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemStatus,
  ListItemTitle,
  ListItemVisual,
  Popover,
  ProgressCircle,
  Tooltip,
  type PopoverProps
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import {appAtom} from '../App.js'
import {
  activityAtom,
  activityPendingAtom,
  discardActivityAtom,
  retryActivityAtom
} from '../atoms/activity.js'
import {routeAtom} from '../atoms/nav.js'
import type {Activity} from '../boot/ActivityEvent.js'
import {IcRoundCheck, IcRoundHistory, IcRoundWarning} from '../icons.js'
import css from './ActivityStatus.module.css'

const styles = styler(css)
const mobileActivityMediaQuery = '(max-width: 768px)'

function subscribeToMobileActivity(onStoreChange: () => void): () => void {
  const media = window.matchMedia?.(mobileActivityMediaQuery)
  if (!media) return () => {}
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function mobileActivitySnapshot() {
  return window.matchMedia?.(mobileActivityMediaQuery).matches ?? false
}

function desktopActivitySnapshot() {
  return false
}

function ignoreActivityBreakpoint() {
  return () => {}
}

export interface ActivityStatusProps {
  ariaLabel?: string
  children?: ReactNode
  mobilePlacement?: PopoverProps['placement']
  openOnFail?: boolean
  placement?: PopoverProps['placement']
}

export function ActivityStatus({
  ariaLabel,
  children,
  mobilePlacement,
  openOnFail = false,
  placement = 'right'
}: ActivityStatusProps) {
  const [appPending] = useAtomValue(appAtom)
  const activity = useAtomValue(activityAtom)
  const retry = useSetAtom(retryActivityAtom)
  const discard = useSetAtom(discardActivityAtom)
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useSyncExternalStore(
    mobilePlacement ? subscribeToMobileActivity : ignoreActivityBreakpoint,
    mobilePlacement ? mobileActivitySnapshot : desktopActivitySnapshot,
    desktopActivitySnapshot
  )
  const wasFailed = useRef(false)
  const lastActivityLabel = useRef('Finishing up')
  const activityLabel = getActivityLabel(
    activity.isFetchingUpdates,
    appPending,
    activity.isMutating
  )
  const showSpinner = useAtomValue(activityPendingAtom)
  if (activityLabel !== undefined) lastActivityLabel.current = activityLabel
  const visibleActivityLabel =
    activityLabel ?? (showSpinner ? lastActivityLabel.current : undefined)
  const label = getStatusLabel(
    visibleActivityLabel,
    activity.hasFailed,
    activity.hasBlocked
  )

  // Opening on a failed activity transition is an integration response to the
  // external activity stream, rather than derived rendering state.
  // eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  // eslint-disable react-you-might-not-need-an-effect/no-event-handler
  useEffect(() => {
    if (openOnFail && activity.hasFailed && !wasFailed.current) setIsOpen(true)
    wasFailed.current = activity.hasFailed
  }, [activity.hasFailed, openOnFail])

  // eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change
  // eslint-enable react-you-might-not-need-an-effect/no-event-handler
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip
        placement={isMobile ? mobilePlacement : placement}
        delay={300}
        tooltip={label}
      >
        <Button
          size={children ? undefined : 'icon'}
          appearance={children ? 'outline' : 'plain'}
          className={styles.ActivityStatus({
            failed: activity.hasFailed,
            syncing: showSpinner
          })}
          aria-label={children ? ariaLabel : label}
        >
          {children ? (
            <span className={styles.ActivityStatus.label()}>
              {showSpinner ? (
                <ProgressCircle
                  isIndeterminate
                  aria-label={label}
                  className={styles.ActivityStatus.icon()}
                />
              ) : activity.hasFailed ? (
                <IcRoundWarning
                  aria-hidden="true"
                  className={styles.ActivityStatus.icon()}
                />
              ) : (
                <IcRoundCheck
                  aria-hidden="true"
                  className={styles.ActivityStatus.icon()}
                />
              )}
              {children}
            </span>
          ) : showSpinner ? (
            <ProgressCircle
              isIndeterminate
              aria-label={label}
              className={styles.ActivityStatus.icon()}
            />
          ) : activity.hasFailed ? (
            <IcRoundWarning
              aria-hidden="true"
              className={styles.ActivityStatus.icon()}
            />
          ) : (
            <IcRoundCheck
              aria-hidden="true"
              className={styles.ActivityStatus.icon()}
            />
          )}
        </Button>
      </Tooltip>
      <Popover
        className={styles.ActivityStatus.popover.surface()}
        placement={isMobile ? mobilePlacement : placement}
        offset={16}
        style={{
          padding: '0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
        }}
      >
        <div className={styles.ActivityStatus.popover()}>
          <div className={styles.ActivityStatus.popover.header()}>
            <h2 className={styles.ActivityStatus.popover.title()}>Activity</h2>
            {activity.hasFailed && (
              <div className={styles.ActivityStatus.popover.actions()}>
                {activity.canDiscard && (
                  <Button
                    size="small"
                    appearance="plain"
                    intent="danger"
                    onPress={() => discard()}
                  >
                    Discard
                  </Button>
                )}
                {activity.canRetry && (
                  <Button
                    size="small"
                    appearance="outline"
                    intent="danger"
                    onPress={() => retry()}
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
          <List
            aria-label="Recent activity"
            className={styles.ActivityStatus.popover.list()}
            empty={activity.items.length === 0}
          >
            {activity.items.length === 0 ? (
              <ListEmpty icon={IcRoundHistory} title="No recent activity">
                Actions and content updates will appear here.
              </ListEmpty>
            ) : (
              activity.items.map(item => (
                <ActivityItem activity={item} key={item.id} />
              ))
            )}
          </List>
        </div>
      </Popover>
    </DialogTrigger>
  )
}

interface ActivityItemProps {
  activity: Activity
}

function ActivityItem({activity}: ActivityItemProps) {
  const setRoute = useSetAtom(routeAtom)
  const showSpinner = activity.status === 'running'
  const displayedStatus = formatActivityStatus(activity)
  const target = activity.target

  return (
    <ListItem
      inner={
        activity.error && (
          <p className={styles.ActivityStatus.popover.item.error()}>
            {activity.error}
          </p>
        )
      }
      onPress={
        target
          ? () =>
              setRoute({
                workspace: target.workspace,
                root: target.root,
                entry: target.entry,
                locale: target.locale ?? undefined
              })
          : undefined
      }
      leading={
        <ListItemVisual>
          {showSpinner ? (
            <ProgressCircle
              isIndeterminate
              aria-label={displayedStatus}
              className={styles.ActivityStatus.icon()}
            />
          ) : (
            <Icon data-slot="icon" icon={activityStatusIcon(activity.status)} />
          )}
        </ListItemVisual>
      }
      trailing={
        <ListItemStatus
          tone={showSpinner ? 'accent' : activityStatusTone(activity.status)}
        >
          {displayedStatus}
        </ListItemStatus>
      }
    >
      <ListItemTitle>{formatActivityTitle(activity)}</ListItemTitle>
      <ListItemDescription>
        {formatActivityDescription(activity)}
      </ListItemDescription>
    </ListItem>
  )
}

function getActivityLabel(
  isFetchingUpdates: boolean,
  isNavigating: boolean,
  isMutating: boolean
) {
  if (isFetchingUpdates) return 'Fetching updates'
  if (isNavigating) return 'Loading page'
  if (isMutating) return 'Syncing changes'
}

function getStatusLabel(
  activity: string | undefined,
  hasFailed: boolean,
  hasBlocked: boolean
) {
  if (activity) {
    return hasFailed ? `${activity}; some actions failed` : activity
  }
  if (hasFailed) return 'Activity failed'
  if (hasBlocked) return 'Actions waiting'
  return 'Content is up to date'
}

function formatActivityStatus(activity: Activity) {
  switch (activity.status) {
    case 'pending':
      return 'Pending'
    case 'running':
      if (activity.type === 'fetch') return 'Fetching'
      if (activity.type === 'upload') return 'Uploading'
      if (isFileActivity(activity)) return 'Saving'
      return 'Syncing'
    case 'succeeded':
      if (activity.type === 'fetch') return 'Up to date'
      if (isFileActivity(activity)) return 'Uploaded'
      return 'Synced'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Waiting'
    case 'discarded':
      return 'Discarded'
    case 'cancelled':
      return 'Cancelled'
  }
}

function activityStatusIcon(status: Activity['status']) {
  switch (status) {
    case 'succeeded':
      return IcRoundCheck
    case 'failed':
    case 'blocked':
      return IcRoundWarning
    default:
      return IcRoundHistory
  }
}

function activityStatusTone(status: Activity['status']) {
  switch (status) {
    case 'running':
      return 'accent' as const
    case 'succeeded':
      return 'positive' as const
    case 'failed':
      return 'danger' as const
    case 'pending':
    case 'blocked':
      return 'warning' as const
    default:
      return 'neutral' as const
  }
}

function formatActivityTitle(activity: Activity) {
  if (activity.type === 'fetch') {
    if (activity.status === 'running') return 'Fetching updates'
    if (activity.status === 'failed') return 'Fetching updates failed'
    return 'Checked for updates'
  }
  const uploadTitle = formatUploadTitle(activity)
  if (uploadTitle) return uploadTitle
  const titles = [
    ...new Set(
      activity.operations.map(operation => operation.title).filter(isString)
    )
  ]
  if (titles.length === 1) return titles[0]
  if (titles.length > 1) return `${titles.length} entries`
  if (activity.type === 'upload') return 'File upload'
  return 'Content changes'
}

function formatActivityDescription(activity: Activity) {
  const details =
    activity.type === 'fetch'
      ? fetchDescription(activity.status)
      : activity.type === 'mutation' && isFileActivity(activity)
        ? fileMutationDescription(activity.status)
        : activity.operations
            .map(operation =>
              formatActivityOperation(operation, activity.status)
            )
            .join(' · ')
  const timestamp = activity.finishedAt ?? activity.startedAt
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  return details ? `${details} · ${time}` : time
}

function isFileActivity(activity: Activity) {
  return (
    activity.type === 'upload' ||
    activity.operations.some(operation => operation.op === 'uploadFile')
  )
}

function formatUploadTitle(activity: Activity) {
  const upload = activity.operations.find(
    operation => operation.op === 'uploadFile'
  )
  if (!upload?.title) return
  const created = activity.operations.find(
    operation => operation.op === 'create' && operation.title
  )
  if (!created?.title) return upload.title
  const dot = upload.title.lastIndexOf('.')
  const extension = dot < 0 ? '' : upload.title.slice(dot)
  return created.title.endsWith(extension)
    ? created.title
    : `${created.title}${extension}`
}

function fileMutationDescription(status: Activity['status']) {
  if (status === 'pending' || status === 'running')
    return 'Saving uploaded file.'
  if (status === 'succeeded') return 'Uploaded file.'
  if (status === 'failed') return 'Could not save uploaded file.'
  if (status === 'blocked') return 'Waiting to save uploaded file.'
  if (status === 'discarded') return 'Upload discarded.'
  return 'Upload cancelled.'
}

function fetchDescription(status: Activity['status']) {
  if (status === 'running') return 'Checking for content changes.'
  if (status === 'succeeded') return 'Content is up to date.'
  if (status === 'failed') return 'Could not check for content changes.'
  return 'Content update check.'
}

function formatActivityOperation(
  operation: {
    op: string
    title?: string
    locale?: string | null
    status?: string
    progress?: {loaded: number; total?: number}
  },
  activityStatus: Activity['status']
) {
  const progress = operation.progress
    ? ` ${formatProgress(operation.progress)}`
    : ''
  const status = operation.status
    ? ` ${formatEntryStatus(operation.status)}`
    : ''
  const locale = operation.locale ? ` (${operation.locale})` : ''
  switch (operation.op) {
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
      if (activityStatus === 'running') return `Uploading file${progress}`
      if (activityStatus === 'failed') return 'Upload failed'
      if (activityStatus === 'discarded') return 'Upload discarded'
      return 'Uploaded file'
    case 'removeFile':
      return 'Removed file'
    default:
      return operation.op
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
