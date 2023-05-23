import {EntryPhase} from 'alinea/core'
import {AppBar, Button, HStack, Icon, Stack, Typo, fromModule} from 'alinea/ui'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {useAtomValue, useSetAtom} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {EditMode} from './EditMode.js'
import css from './EntryHeader.module.scss'

const styles = fromModule(css)

const variantDescription = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
}

const variantIcon = {
  draft: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  archived: IcRoundArchive
}

export type EntryHeaderProps = {
  editor: EntryEditor
  mode: EditMode
  setMode?: (mode: EditMode) => void
}

export function EntryHeader({mode, setMode, editor}: EntryHeaderProps) {
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const isActivePhase = editor.activePhase === selectedPhase
  const hasChanges = useAtomValue(editor.hasChanges)
  const isSaving = useAtomValue(editor.isSaving)
  const variant =
    (hasChanges || isSaving) && isActivePhase ? 'draft' : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  return (
    <AppBar.Root variant={variant}>
      <HStack center gap={10} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />
        <span>{variantDescription[variant]}</span>
        {isActivePhase &&
          (hasChanges || isSaving ? (
            <span>(unsaved changes detected)</span>
          ) : (
            <span>(edit to create a new draft)</span>
          ))}
        <Stack.Right>
          {hasChanges && variant === 'draft' && (
            <Button icon={IcRoundCheck} onClick={saveDraft}>
              Save draft
            </Button>
          )}
          {!hasChanges && selectedPhase === 'draft' && (
            <Button icon={IcOutlineRemoveRedEye} onClick={publishDraft}>
              Publish draft
            </Button>
          )}
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
  /*const nav = useNav()
  const {schema} = useConfig()
  const {name: workspace} = useWorkspace()
  const root = useRoot()
  const currentLocale = useLocale()
  const navigate = useNavigate()
  const phase = editor.phase
  const version = editor.version
  const parent = version.parent
  const type = schema[version.type]
  const Icon = type && Type.meta(type).icon
  function handleDiscard() {
    return drafts.discard(draft).then(([entryRemains, err]) => {
      queryClient.invalidateQueries(['draft', draft.versionId])
      if (!entryRemains) {
        queryClient.invalidateQueries(['tree'])
        // Navigate to parent, otherwise we'll 404
        navigate(nav.entry({workspace, root: root.name, id: parent}))
      }
    })
  }
  function handlePublish() {
    setPublishing(true)
    return drafts
      .publish(draft)
      .then(() => {
        queryClient.invalidateQueries([
          'children',
          draft.alinea.workspace,
          draft.alinea.root,
          draft.alinea.parent
        ])
      })
      .finally(() => {
        setPublishing(false)
      })
  }*/
  return (
    <AppBar.Root>
      <AppBar.Item full style={{flexGrow: 1}}>
        <Typo.Monospace className={styles.root.url()}>
          <HStack gap={8} center>
            <div style={{flexShrink: 0}}>
              {Icon ? (
                <Icon />
              ) : (
                <IcRoundInsertDriveFile style={{display: 'block'}} />
              )}
            </div>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {version.url}
            </span>
          </HStack>
        </Typo.Monospace>
      </AppBar.Item>
      {/*root.i18n && (
        <HStack center gap={8}>
          {root.i18n.locales.map(locale => {
            const translation = draft.translation(locale)
            const to = translation || draft
            return (
              <a
                key={locale}
                {...link(
                  nav.entry({
                    workspace: to.alinea.workspace,
                    root: to.alinea.root,
                    id: to.id,
                    locale
                  })
                )}
              >
                <Chip accent={currentLocale === locale}>
                  {translation ? (
                    <>{locale.toUpperCase()}: ✅</>
                  ) : (
                    <>{locale.toUpperCase()}: ❌</>
                  )}
                </Chip>
              </a>
            )
          })}
        </HStack>
      )*/}
      <Stack.Right>
        <AppBar.Item>status</AppBar.Item>
      </Stack.Right>
      {selectedPhase === EntryPhase.Draft &&
        mode === EditMode.Editing &&
        setMode && (
          <AppBar.Item
            as="button"
            icon={MdiSourceBranch}
            onClick={() => setMode(EditMode.Diff)}
          >
            <span>View changes</span>
          </AppBar.Item>
        )}
      {selectedPhase === EntryPhase.Draft &&
        mode === EditMode.Diff &&
        setMode && (
          <AppBar.Item
            as="button"
            icon={IcRoundEdit}
            onClick={() => setMode(EditMode.Editing)}
          >
            <span>Edit entry</span>
          </AppBar.Item>
        )}
      {selectedPhase === EntryPhase.Draft && (
        <AppBar.Item as="button" icon={IcRoundDelete}>
          <span>Discard</span>
        </AppBar.Item>
      )}
      {selectedPhase !== EntryPhase.Published && (
        <AppBar.Item as="button" icon={IcRoundPublish}>
          <span>Publish</span>
        </AppBar.Item>
      )}
    </AppBar.Root>
  )
}
