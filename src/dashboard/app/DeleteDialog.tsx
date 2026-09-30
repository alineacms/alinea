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
import {IcRoundDelete, IcRoundWarning} from '../icons.js'
import css from './DeleteDialog.module.css'
import {EntryReferenceList} from './EntryReferences.js'
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
}

/** Confirms deleting entries, warning about the links that will break */
export function DeleteDialog({plan, onClose, onConfirm}: DeleteDialogProps) {
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
        />
      )}
    </DashboardModal>
  )
}

const maxListedSources = 3

function referenceSourceKey(reference: {
  sourceId: string
  sourceLocale: string | null
}) {
  return [reference.sourceId, reference.sourceLocale].join('\0')
}

interface DeleteDialogContentProps {
  plan: DeletePlan
  onClose(): void
  onConfirm(plan: DeletePlan): Promise<void>
}

function DeleteDialogContent({
  plan,
  onClose,
  onConfirm
}: DeleteDialogContentProps) {
  const config = useAtomValueRaw(configAtom)
  const [selectedLocales, setSelectedLocales] = useAtom(plan.selectedLocales)
  const removals = useAtomValueRaw(plan.removals)
  const references = useAtomValueRaw(plan.references)
  const setRoute = useSetAtom(routeAtom)
  const setSidebarTab = useSetAtom(entrySidebarTabAtom)
  const setSidebarOpen = useSetAtom(entrySidebarOpenAtom)
  const [isPending, startTransition] = useTransition()
  const {subjects, locales} = plan
  const count = subjects.length
  const typeOf = (type: string) => config.schema[type]
  const files = subjects.filter(item => typeOf(item.type) === MediaFile)
  const folders = subjects.filter(item => typeOf(item.type) === MediaLibrary)
  const parents = subjects.filter(
    item => item.hasChildren && typeOf(item.type) !== MediaLibrary
  )
  const noun = files.length ? 'file' : folders.length ? 'folder' : 'entry'
  const sourceKeys = Array.from(
    new Set(references.map(({reference}) => referenceSourceKey(reference)))
  )
  const sources = sourceKeys.length
  // Hundreds of references would push the actions out of view, list a few
  const listedKeys = new Set(sourceKeys.slice(0, maxListedSources))
  const listedReferences = references.filter(({reference}) =>
    listedKeys.has(referenceSourceKey(reference))
  )
  const unlisted = sources - listedKeys.size
  const onlyFiles = files.length === count
  const pickLocales = locales.length > 1

  function confirm() {
    startTransition(async () => {
      await onConfirm(plan)
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
        {sources > 0 && (
          <>
            <Alert variant="destructive" icon={IcRoundWarning}>
              <AlertTitle>
                {count === 1 ? `This ${noun} has` : 'These items have'}{' '}
                {sources} {sources === 1 ? 'reference' : 'references'}
              </AlertTitle>
              <AlertDescription>
                The links to it from these entries will break.
              </AlertDescription>
            </Alert>
            <EntryReferenceList
              references={listedReferences}
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
              (count === 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const [subject] = subjects
                    onClose()
                    setRoute({
                      workspace: subject.workspace,
                      root: subject.root,
                      entry: subject.id,
                      locale: subject.locale ?? undefined
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
          </>
        )}
      </DashboardModalContent>
      <DashboardModalFooter>
        <div className={styles.DeleteDialog.actions()}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="destructive"
            icon={IcRoundDelete}
            disabled={isPending || removals.length === 0}
            loading={isPending}
            onClick={confirm}
          >
            Delete
          </Button>
        </div>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}
