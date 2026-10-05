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
import type {DeletePlan} from '#/dashboard/atoms/delete.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useTransition} from 'react'
import {IcRoundArchive, IcRoundDelete, IcRoundWarning} from '../icons.js'
import css from './DeleteDialog.module.css'
import {countReferenceSources, EntryReferenceList} from './EntryReferences.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface DeleteDialogProps {
  /** What to delete, loaded before it opens, closed when undefined */
  plan: DeletePlan | undefined
  onClose(): void
  onConfirm(plan: DeletePlan): Promise<void>
  /** Archives the entries instead, offered when all of them can be */
  onArchive?(plan: DeletePlan): Promise<void>
}

/** Confirms deleting entries, warning about the links that will break */
export function DeleteDialog({
  plan,
  onClose,
  onConfirm,
  onArchive
}: DeleteDialogProps) {
  return (
    <DashboardModal
      open={Boolean(plan)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {plan && (
        <DeleteDialogContent
          plan={plan}
          onClose={onClose}
          onConfirm={onConfirm}
          onArchive={onArchive}
        />
      )}
    </DashboardModal>
  )
}

// Hundreds of references would push the actions out of view, list a few
const maxListedSources = 3

interface DeleteDialogContentProps {
  plan: DeletePlan
  onClose(): void
  onConfirm(plan: DeletePlan): Promise<void>
  onArchive?(plan: DeletePlan): Promise<void>
}

function DeleteDialogContent({
  plan,
  onClose,
  onConfirm,
  onArchive
}: DeleteDialogContentProps) {
  const config = useAtomValueRaw(configAtom)
  const [selectedLocales, setSelectedLocales] = useAtom(plan.selectedLocales)
  const removals = useAtomValueRaw(plan.removals)
  const references = useAtomValueRaw(plan.references)
  const hiddenSources = useAtomValueRaw(plan.hiddenSources)
  const archivable = useAtomValueRaw(plan.archivable)
  const setRoute = useSetAtom(routeAtom)
  const setSidebarTab = useSetAtom(entrySidebarTabAtom)
  const setSidebarOpen = useSetAtom(entrySidebarOpenAtom)
  const [isDeleting, startDelete] = useTransition()
  const [isArchiving, startArchive] = useTransition()
  const isPending = isDeleting || isArchiving
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
  // Links to the entries or files inside the deleted ones
  const nested = references.some(
    ({reference}) => !subjects.some(item => item.id === reference.targetId)
  )
  const onlyFiles = files.length === count
  const [first] = subjects
  // An entry is not translated in the language it is shown in when none is
  // picked at first, it offers the languages it exists in
  const pickLocales =
    locales !== undefined &&
    (locales.length > 1 ||
      (locales.length === 1 && locales[0] !== first.locale))

  function confirm() {
    startDelete(async () => {
      await onConfirm(plan)
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
      label={count === 1 ? `Delete ${noun}` : `Delete ${count} items`}
    >
      <DashboardModalContent>
        <Text as="p">
          {onlyFiles
            ? `${count === 1 ? 'This file' : `${count} files`} will be permanently deleted from the media library and its storage.`
            : `${count === 1 ? `This ${noun}` : `${count} items`} will be permanently deleted and cannot be recovered afterwards.`}
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
        {files.length > 0 && !onlyFiles && (
          <Text as="p">
            {files.length === 1
              ? 'The file is removed from the media library and its storage.'
              : `${files.length} files are removed from the media library and its storage.`}
          </Text>
        )}
        {folders.length > 0 && (
          <Text as="p">
            {folders.length === 1
              ? 'The folder is deleted with every file in it.'
              : `${folders.length} folders are deleted with every file in them.`}
          </Text>
        )}
        {parents.length > 0 && (
          <Text as="p">
            Entries are deleted with the entries they contain
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
        <div className={styles.DeleteDialog.actions()}>
          <Button variant="outline" color="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="destructive"
            icon={IcRoundDelete}
            disabled={isPending || removals.length === 0}
            loading={isDeleting}
            onClick={confirm}
          >
            Delete
          </Button>
        </div>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}
