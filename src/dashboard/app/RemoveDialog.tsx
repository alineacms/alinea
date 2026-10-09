import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  CheckboxGroup,
  Text
} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {
  entrySidebarOpenAtom,
  entrySidebarTabAtom
} from '#/dashboard/atoms/dashboard.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {
  archiveDirectlyAtom,
  type RemoveAction,
  type RemovePlan
} from '#/dashboard/atoms/remove.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useState, useTransition} from 'react'
import {IcRoundArchive, IcRoundDelete, IcRoundWarning} from '../icons.js'
import {countReferenceSources, EntryReferenceList} from './EntryReferences.js'
import css from './RemoveDialog.module.css'
import {RemoveRedirect} from './RemoveRedirect.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface RemoveDialogProps {
  action: RemoveAction
  /** What to remove, loaded before it opens, closed when undefined */
  plan: RemovePlan | undefined
  onClose(): void
  /** Deletes or archives the entries, as the action says */
  onConfirm(plan: RemovePlan): Promise<void>
  /** Archives the entries instead of deleting them, offered when all of them
   * can be */
  onArchive?(plan: RemovePlan): Promise<void>
}

/**
 * Confirms deleting or archiving entries, warning about the links that will
 * break, and redirects their URLs to another page
 */
export function RemoveDialog({
  action,
  plan,
  onClose,
  onConfirm,
  onArchive
}: RemoveDialogProps) {
  return (
    <DashboardModal
      open={Boolean(plan)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {plan && (
        <RemoveDialogContent
          action={action}
          plan={plan}
          onClose={onClose}
          onConfirm={onConfirm}
          onArchive={action === 'delete' ? onArchive : undefined}
        />
      )}
    </DashboardModal>
  )
}

// Hundreds of references would push the actions out of view, list a few
const maxListedSources = 3

interface RemoveDialogContentProps {
  action: RemoveAction
  plan: RemovePlan
  onClose(): void
  onConfirm(plan: RemovePlan): Promise<void>
  onArchive?(plan: RemovePlan): Promise<void>
}

function RemoveDialogContent({
  action,
  plan,
  onClose,
  onConfirm,
  onArchive
}: RemoveDialogContentProps) {
  const config = useAtomValueRaw(configAtom)
  const [selectedLocales, setSelectedLocales] = useAtom(plan.selectedLocales)
  const removals = useAtomValueRaw(plan.removals)
  const references = useAtomValueRaw(plan.references)
  const hiddenSources = useAtomValueRaw(plan.hiddenSources)
  const archivable = useAtomValueRaw(plan.archivable)
  const urls = useAtomValueRaw(plan.urls)
  const setArchiveDirectly = useSetAtom(archiveDirectlyAtom)
  const setRoute = useSetAtom(routeAtom)
  const setSidebarTab = useSetAtom(entrySidebarTabAtom)
  const setSidebarOpen = useSetAtom(entrySidebarOpenAtom)
  const [isConfirming, startConfirm] = useTransition()
  const [isArchiving, startArchive] = useTransition()
  const [skipDialog, setSkipDialog] = useState(false)
  const isPending = isConfirming || isArchiving
  const isDelete = action === 'delete'
  const {subjects, locales} = plan
  const count = subjects.length
  const typeOf = (type: string) => config.schema[type]
  const files = subjects.filter(item => typeOf(item.type) === MediaFile)
  const folders = subjects.filter(item => typeOf(item.type) === MediaLibrary)
  const parents = subjects.filter(
    item => item.hasChildren && typeOf(item.type) !== MediaLibrary
  )
  const noun = files.length ? 'file' : folders.length ? 'folder' : 'entry'
  const sources = countReferenceSources(references)
  const hiddenEntries =
    hiddenSources === 1 ? '1 entry' : `${hiddenSources} entries`
  const total = sources + hiddenSources
  const unlisted = Math.max(0, sources - maxListedSources)
  // Links to the entries or files inside the removed ones
  const nested = references.some(
    ({reference}) => !subjects.some(item => item.id === reference.targetId)
  )
  const onlyFiles = files.length === count
  const pages = new Set(urls.map(url => url.id)).size
  const [first] = subjects
  // An entry is not translated in the language it is shown in when none is
  // picked at first, it offers the languages it exists in
  const pickLocales =
    isDelete &&
    locales !== undefined &&
    (locales.length > 1 ||
      (locales.length === 1 && locales[0] !== first.locale))
  const these = count === 1 ? `This ${noun}` : `${count} items`

  function confirm() {
    startConfirm(async () => {
      await onConfirm(plan)
      if (!isDelete && skipDialog) setArchiveDirectly(true)
      onClose()
    })
  }

  function archive() {
    startArchive(async () => {
      await onArchive?.(plan)
      onClose()
    })
  }

  return (
    <DashboardModalDialog
      label={
        count === 1
          ? `${isDelete ? 'Delete' : 'Archive'} ${noun}`
          : `${isDelete ? 'Delete' : 'Archive'} ${count} items`
      }
    >
      <DashboardModalContent>
        <Text as="p">
          {!isDelete
            ? // Archived entries are unpublished but can be restored
              `${these} will be archived and can be restored later.`
            : onlyFiles
              ? `${count === 1 ? 'This file' : `${count} files`} will be permanently deleted from the media library and its storage.`
              : `${these} will be permanently deleted and cannot be recovered afterwards.`}
        </Text>
        {pickLocales && (
          <CheckboxGroup
            label="Languages to delete"
            orientation="horizontal"
            value={selectedLocales}
            onValueChange={setSelectedLocales}
          >
            {locales.map(locale => (
              <Checkbox key={locale} value={locale}>
                {locale.toUpperCase()}
              </Checkbox>
            ))}
          </CheckboxGroup>
        )}
        {isDelete && files.length > 0 && !onlyFiles && (
          <Text as="p">
            {files.length === 1
              ? 'The file is removed from the media library and its storage.'
              : `${files.length} files are removed from the media library and its storage.`}
          </Text>
        )}
        {isDelete && folders.length > 0 && (
          <Text as="p">
            {folders.length === 1
              ? 'The folder is deleted with every file in it.'
              : `${folders.length} folders are deleted with every file in them.`}
          </Text>
        )}
        {parents.length > 0 && (
          <Text as="p">
            Entries are {isDelete ? 'deleted' : 'archived'} with the entries
            they contain
            {pickLocales ? ', in the selected languages.' : '.'}
          </Text>
        )}
        {total > 0 && (
          <>
            <Alert variant="destructive" icon={IcRoundWarning}>
              <AlertTitle>
                {count === 1 ? `This ${noun}` : 'These items'}
                {nested &&
                  (count === 1 ? ' and its contents' : ' and their contents')}
                {count === 1 && !nested ? ' has ' : ' have '}
                {total} {total === 1 ? 'reference' : 'references'}
              </AlertTitle>
              <AlertDescription>
                {sources > 0
                  ? 'The links from these entries will break.'
                  : `The links from ${hiddenEntries} you can't access will break.`}
              </AlertDescription>
            </Alert>
            <EntryReferenceList
              references={references}
              limit={maxListedSources}
              locale={null}
              onSelect={(source, locale) => {
                onClose()
                setRoute({
                  workspace: source.workspace,
                  root: source.root,
                  entry: source.id,
                  locale: locale ?? undefined
                })
              }}
            />
            {unlisted > 0 &&
              // The references tab lists the links to the entry itself
              (count === 1 && !nested ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const [subject] = subjects
                    const locale =
                      selectedLocales.length === 1
                        ? selectedLocales[0]
                        : subject.locale
                    onClose()
                    setRoute({
                      workspace: subject.workspace,
                      root: subject.root,
                      entry: subject.id,
                      locale: locale ?? undefined,
                      view: 'edit'
                    })
                    setSidebarTab('references')
                    setSidebarOpen(true)
                  }}
                >
                  See all {sources} references
                </Button>
              ) : (
                <Text as="p" size="sm" color="muted">
                  And {unlisted} more {unlisted === 1 ? 'entry' : 'entries'}.
                </Text>
              ))}
            {sources > 0 &&
              hiddenSources > 0 && (
                // Their titles stay hidden
                <Text as="p" size="sm" color="muted">
                  And links in {hiddenEntries} you can't access.
                </Text>
              )}
          </>
        )}
        {total === 0 && pages > 0 && (
          <Text as="p" color="muted">
            {pages === 1
              ? 'If this page was publicly available, links to its URL may still be around elsewhere. It can be useful to redirect its URL to another page.'
              : 'If these pages were publicly available, links to their URLs may still be around elsewhere. It can be useful to redirect their URLs to another page.'}
          </Text>
        )}
        <RemoveRedirect plan={plan} disabled={isPending} />
      </DashboardModalContent>
      <DashboardModalFooter>
        {onArchive &&
          archivable && (
            // Archived entries are unpublished but can be restored
            <Button
              variant="outline"
              icon={IcRoundArchive}
              disabled={isPending}
              loading={isArchiving}
              onClick={archive}
            >
              Archive instead
            </Button>
          )}
        {!isDelete && (
          <Checkbox
            checked={skipDialog}
            onCheckedChange={setSkipDialog}
            disabled={isPending}
          >
            Don't show this again during this session
          </Checkbox>
        )}
        <div className={styles.RemoveDialog.actions()}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {isDelete ? (
            <Button
              color="destructive"
              icon={IcRoundDelete}
              disabled={isPending || removals.length === 0}
              loading={isConfirming}
              onClick={confirm}
            >
              Delete
            </Button>
          ) : (
            <Button
              color="primary"
              icon={IcRoundArchive}
              disabled={isPending || removals.length === 0}
              loading={isConfirming}
              onClick={confirm}
            >
              Archive
            </Button>
          )}
        </div>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}
