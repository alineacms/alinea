import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Button,
  Timestamp
} from '#/components.js'
import type {EditorUser} from '#/core/EditLock.js'
import type {EntryLockAtoms, LockStatus} from '#/dashboard/atoms/lock.js'
import {userAtom} from '#/dashboard/atoms/user.js'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useEffect, useState} from 'react'
import {IcRoundLock} from '../icons.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

// The holder sends a heartbeat at least this often while its tab is visible
const idleAfter = 20_000

export interface EntryLockNoticeProps {
  lock: EntryLockAtoms
  status: LockStatus
}

/** Shown while another session holds the entry */
export function EntryLockNotice({lock, status}: EntryLockNoticeProps) {
  const user = useAtomValueRaw(userAtom)
  const request = useAtomValueRaw(lock.request)
  const ask = useSetAtom(lock.ask)
  const mine = status.request?.mine ? status.request : undefined
  const seconds = useSecondsLeft(mine ? status.at + mine.remaining : undefined)
  const holder = status.holder
  if (!holder) return null
  const name = editorName(holder.user)
  const otherTab = holder.user.sub === user.sub
  const waiting = request === 'asking'
  return (
    <Alert icon={IcRoundLock}>
      <AlertTitle>
        {otherTab
          ? 'This page is open in another tab'
          : `This page is being edited by ${name}`}
      </AlertTitle>
      {request === 'declined' ? (
        <AlertDescription>
          {name} declined your request to edit
        </AlertDescription>
      ) : (
        holder.idle > idleAfter && (
          <AlertDescription>
            Last seen{' '}
            <Timestamp date={status.at - holder.idle} format="relative" />
          </AlertDescription>
        )
      )}
      <AlertActions>
        <Button size="sm" disabled={waiting} onClick={() => void ask()}>
          {otherTab
            ? 'Edit here'
            : waiting
              ? `Waiting for ${name}${seconds ? ` (${seconds}s)` : ''}`
              : 'Ask to edit'}
        </Button>
      </AlertActions>
    </Alert>
  )
}

export interface EntryLockDialogsProps {
  lock: EntryLockAtoms
  status: LockStatus | undefined
  isDirty: boolean
  onDiscard(): void
  /** Saves the changes, which merges them with those saved meanwhile */
  onMerge(): void
}

/** Asks the holder to hand over, and tells it when it lost control */
export function EntryLockDialogs({
  lock,
  status,
  isDirty,
  onDiscard,
  onMerge
}: EntryLockDialogsProps) {
  const user = useAtomValueRaw(userAtom)
  const [away, setAway] = useAtom(lock.away)
  const answer = useSetAtom(lock.beat)
  const pending = status?.holds ? status.request : undefined
  const seconds = useSecondsLeft(
    status && pending ? status.at + pending.remaining : undefined
  )
  const close = () => setAway(undefined)
  if (away) {
    const otherTab = away.sub === user.sub
    return (
      <DashboardModal open onOpenChange={open => !open && close()}>
        <DashboardModalDialog
          label={
            otherTab
              ? 'You continued editing this page in another tab'
              : `While you were away, ${editorName(away)} was given control of this page`
          }
        >
          {isDirty && (
            <DashboardModalContent>
              Your changes have not been saved.
            </DashboardModalContent>
          )}
          <DashboardModalFooter>
            {isDirty ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onDiscard()
                    close()
                  }}
                >
                  Discard my changes
                </Button>
                <Button
                  color="primary"
                  onClick={() => {
                    onMerge()
                    close()
                  }}
                >
                  Merge my changes
                </Button>
              </>
            ) : (
              <Button color="primary" onClick={close}>
                OK
              </Button>
            )}
          </DashboardModalFooter>
        </DashboardModalDialog>
      </DashboardModal>
    )
  }
  if (!pending || !seconds) return null
  const name = editorName(pending.user)
  return (
    <DashboardModal
      open
      dismissable={false}
      onOpenChange={open => !open && void answer('decline')}
    >
      <DashboardModalDialog label={`${name} asks to edit this page`}>
        <DashboardModalContent>
          {name} gets control in {seconds} seconds unless you decline.
        </DashboardModalContent>
        <DashboardModalFooter>
          <Button variant="ghost" onClick={() => void answer('decline')}>
            Decline
          </Button>
          <Button color="primary" onClick={() => void answer('allow')}>
            Allow
          </Button>
        </DashboardModalFooter>
      </DashboardModalDialog>
    </DashboardModal>
  )
}

function editorName(user: EditorUser): string {
  return user.name ?? user.email ?? user.sub
}

/** Counts down to a time, in whole seconds */
function useSecondsLeft(until: number | undefined): number {
  const [, tick] = useState(0)
  useEffect(() => {
    if (until === undefined) return
    const timer = setInterval(() => tick(count => count + 1), 1000)
    return () => clearInterval(timer)
  }, [until])
  if (until === undefined) return 0
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}
