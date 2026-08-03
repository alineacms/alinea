import {Button, Icon, Surface} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {typeAtoms, workspaceAtoms} from '#/dashboard/atoms/config.js'
import {
  entryAtoms,
  type EntryAtoms,
  type EntryLocaleAtoms,
  MissingEntryError
} from '#/dashboard/atoms/entry.js'
import {Page, page, routeAtom} from '#/dashboard/atoms/nav.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {
  memo,
  PropsWithChildren,
  useEffect,
  useState,
  useTransition
} from 'react'
import {
  EditorScope,
  EntryScope,
  useDashboard,
  useEditor,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit
} from '../../icons.js'
import {
  Dashboard,
  DashboardSection,
  ReactiveNode
} from '../../store/Dashboard.js'
import {FileEditor} from './../editor/FileEditor.js'
import {EntryHeader} from './../EntryHeader.js'
import {EntrySidebar} from './../EntrySidebar.js'
import {EntryTranslationBanner} from './../EntryTranslationBanner.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './../ui/DashboardModal.js'
import {Rail, RailBody, RailContent} from './../ui/Rail.js'
import css from './EntryPage.module.css'

const styles = styler(css)

export interface EditorProps {
  dashboard: Dashboard
}

export const entryPage = page(async (page, get) => {
  assert(page.entry, 'Entry id expected')
  try {
    const entry = await get(entryAtoms(page.entry))
    const localeData = entry.locales(page.locale ?? null)
    const [selectedEntry, node] = await Promise.all([
      get(localeData.selectedEntry),
      get(localeData.selectedNode)
    ])
    return (
      <EntryEditor
        entry={entry}
        localeData={localeData}
        node={node}
        page={page}
        selectedEntry={selectedEntry}
      />
    )
  } catch (error) {
    if (!(error instanceof MissingEntryError)) throw error
    return <MissingEntry page={page} />
  }
})

interface MissingEntryProps {
  page: Page
}

function MissingEntry({page}: MissingEntryProps) {
  assert(page.workspace && page.root && page.entry)
  const {rootsAtom} = workspaceAtoms(page.workspace)
  const root = useAtomValue(rootsAtom(page.root))
  const setRoute = useSetAtom(routeAtom)
  return (
    <NotFoundPanel
      title="Entry not found"
      message="The requested entry could not be found. It may have been deleted, moved, or is no longer available."
      requestedLabel="Requested id"
      requestedValue={page.entry}
      actionLabel={`Go to ${root.label}`}
      onAction={() =>
        setRoute({
          workspace: page.workspace,
          root: page.root,
          locale: page.locale ?? undefined
        })
      }
    />
  )
}

interface NotFoundPanelProps {
  title: string
  message: string
  requestedLabel: string
  requestedValue: string
  actionLabel?: string
  onAction?: () => void
}

function NotFoundPanel({
  title,
  message,
  requestedLabel,
  requestedValue,
  actionLabel,
  onAction
}: NotFoundPanelProps) {
  return (
    <Rail main>
      <RailBody className={styles.MissingEntry()}>
        <Surface className={styles.MissingEntry.card()}>
          <div className={styles.MissingEntry.icon()}>
            <Icon icon={IcBaselineErrorOutline} />
          </div>
          <h1 className={styles.MissingEntry.title()}>{title}</h1>
          <p className={styles.MissingEntry.message()}>{message}</p>
          <p className={styles.MissingEntry.message()}>
            {requestedLabel}:{' '}
            <code className={styles.MissingEntry.id()}>{requestedValue}</code>
          </p>
          {onAction && actionLabel && (
            <Button onPress={onAction}>{actionLabel}</Button>
          )}
        </Surface>
      </RailBody>
    </Rail>
  )
}

interface EntryViewToggleProps {
  entry: EntryAtoms
}

function EntryViewToggle({entry}: EntryViewToggleProps) {
  const view = useAtomValue(entry.view)
  const setView = useSetAtom(entry.view)
  const [isPending, startTransition] = useTransition()
  const nextView = view === 'overview' ? 'edit' : 'overview'
  const label = nextView === 'overview' ? 'Show overview' : 'Edit entry'
  const ViewIcon = nextView === 'overview' ? IcOutlineViewList : IcRoundEdit
  return (
    <Button
      aria-label={label}
      appearance="plain"
      icon={ViewIcon}
      isDisabled={isPending}
      size="icon"
      onPress={() => {
        startTransition(() => {
          setView(nextView)
        })
      }}
    />
  )
}

interface EntryEditorProps {
  page: Page
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  selectedEntry: Entry
  node: ReactiveNode<object>
}

function EntryEditor({
  page,
  entry,
  localeData,
  selectedEntry,
  node
}: EntryEditorProps) {
  const type = useAtomValue(typeAtoms(entry.type))
  const View = type.customView
  const locale = page.locale ?? null
  const isUntranslated = selectedEntry.locale !== locale
  const setEditing = useSetAtom(localeData.currentlyEditing)
  const saveDraft = useSetAtom(entry.saveDraft)
  const publishEdits = useSetAtom(entry.publishEdits)
  const isDirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(entry.routeBlock)
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const defaultView = useAtomValue(entry.defaultView)
  const isMediaFile = type.type === MediaFile
  const isMediaLibrary = type.type === MediaLibrary
  const mediaDraftsDisabled = isMediaFile || isMediaLibrary

  const discardAndConfirm = () => {
    reset()
    routeBlock?.confirm()
  }

  const saveAndConfirm = async () => {
    if (mediaDraftsDisabled) {
      await publishEdits(node)
    } else {
      await saveDraft(node)
    }
    routeBlock?.confirm()
  }

  useEffect(() => {
    if (node.readOnly && !isUntranslated) return
    setEditing(isUntranslated || isDirty ? node : undefined)
  }, [isDirty, isUntranslated, node, setEditing])

  let editorBody = (
    <>
      <RailBody className={styles.EntryEditor.body()}>
        <RailContent>
          {isUntranslated && (
            <div className={styles.EntryEditor.banner()}>
              <EntryTranslationBanner entry={entry} />
            </div>
          )}

          <NodeEditor node={node} type={type.type} />
        </RailContent>
      </RailBody>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        <RailBody className={styles.EntryEditor.body()}>
          <NodeEditor node={node} type={type.type}>
            <FileEditor entry={entry} />
          </NodeEditor>
        </RailBody>
      </>
    )
  }

  if (View) {
    return (
      <EntryScope entry={entry}>
        <View type={type.type} />
      </EntryScope>
    )
  }

  const hasSidebar = !isUntranslated

  const mainEditor = (
    <Rail main>
      <EntryHeader
        controls={
          defaultView === 'overview' ? (
            <EntryViewToggle entry={entry} />
          ) : undefined
        }
        entry={entry}
        isSidebarOpen={isSidebarOpen}
        node={node}
        onSidebarOpenChange={hasSidebar ? setSidebarOpen : undefined}
      />

      {editorBody}

      <div id="alinea-toolbar" className={styles.EntryEditor.toolbar()} />
    </Rail>
  )

  return (
    <>
      <DashboardModal
        isOpen={Boolean(routeBlock)}
        onOpenChange={open => !open && setRouteBlock(null)}
      >
        {routeBlock && (
          <DashboardModalDialog label="Confirm navigation">
            <DashboardModalContent>
              This entry has unsaved changes
            </DashboardModalContent>
            <DashboardModalFooter>
              <Button onPress={discardAndConfirm} intent="secondary">
                Discard my changes
              </Button>
              <Button onPress={saveAndConfirm} intent="primary">
                {mediaDraftsDisabled ? 'Publish' : 'Save as draft'}
              </Button>
            </DashboardModalFooter>
          </DashboardModalDialog>
        )}
      </DashboardModal>
      <EntryScope entry={entry}>
        {mainEditor}
        {hasSidebar && isSidebarOpen && (
          <EntrySidebar entry={entry} onOpenChange={setSidebarOpen} />
        )}
      </EntryScope>
    </>
  )
}

interface NodeEditorProps extends PropsWithChildren {
  node: ReactiveNode<object>
  type: Type
}

export function NodeEditor({
  children = <FieldsEditor />,
  node,
  type
}: NodeEditorProps) {
  const editor = useNodeEditor(node, type)
  return <EditorScope editor={editor}>{children}</EditorScope>
}

export function FieldsEditor() {
  const editor = useEditor()
  return editor.sections.map((section, index) => {
    return <FormSection key={index} section={section} />
  })
}

interface FormSectionProps {
  section: DashboardSection
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {section: section.section}
  if (View) return <View {...props} />
  return <EditFields fields={Section.definition(section.section)} />
})

export interface EditFieldsProps {
  fields: Record<string, Field | Section>
}

export const EditFields = memo(function EditFields({fields}: EditFieldsProps) {
  const dashboard = useDashboard()
  return (
    <div className={styles.EditFields()}>
      {Object.entries(fields).map(([name, value]) => {
        if (Field.isField(value)) return <EditField key={name} field={value} />
        if (Section.isSection(value))
          return (
            <div
              key={name}
              className={styles.EditField.slot()}
              style={{gridColumn: `span ${fieldSpan()}`}}
            >
              <FormSection section={new DashboardSection(dashboard, value)} />
            </div>
          )
        return null
      })}
    </div>
  )
})

interface EditFieldProps {
  field: Field
}

interface FieldLayoutOptions extends FieldOptions<unknown> {
  width?: number
}

export const EditField = memo(function EditField({field}: EditFieldProps) {
  const options = useFieldOptions(field) as FieldLayoutOptions
  const View = useFieldView(field)
  if (options.hidden) return null
  if (field instanceof HiddenField) return null
  if (!View) return <div>Missing view for field: {Field.label(field)}</div>
  return (
    <div
      className={styles.EditField.slot()}
      style={{gridColumn: `span ${fieldSpan(options.width)}`}}
    >
      <View field={field} />
    </div>
  )
})

function fieldSpan(width = 1): number {
  const columns = 12
  return Math.max(1, Math.min(columns, Math.round(width * columns)))
}
