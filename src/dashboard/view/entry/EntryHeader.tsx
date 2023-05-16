import {EntryPhase, Type} from 'alinea/core'
import {link, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {
  AppBar,
  Chip,
  HStack,
  Stack,
  Typo,
  fromModule,
  useObservable
} from 'alinea/ui'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {IcRoundRotateLeft} from 'alinea/ui/icons/IcRoundRotateLeft'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {useConfig} from '../../atoms/DashboardAtoms.js'
import {EntryVersionEditor} from '../../atoms/EntryEditor.js'
import {useCurrentDraft} from '../../hook/UseCurrentDraft.js'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import {EditMode} from './EditMode.js'
import css from './EntryHeader.module.scss'

const styles = fromModule(css)

function EntryStatusChip() {
  const nav = useNav()
  const drafts = useDrafts()
  const draftsStatus = useObservable(drafts.status)
  const draft = useCurrentDraft()
  const status = useObservable(draft.phase)
  switch (status) {
    case EntryPhase.Published:
      return <Chip icon={IcRoundCheck}>Published</Chip>
    case EntryPhase.Draft:
      return (
        <a {...link(nav.draft(draft))} style={{textDecoration: 'none'}}>
          <Chip
            accent
            icon={
              draftsStatus === DraftsStatus.Saving
                ? IcRoundRotateLeft
                : draftsStatus === DraftsStatus.Synced
                ? IcRoundCheck
                : IcRoundEdit
            }
          >
            Draft
          </Chip>
        </a>
      )
    case EntryPhase.Archived:
      return <Chip icon={IcRoundArchive}>Archived</Chip>
  }
}

export type EntryHeaderProps = {
  versionEditor: EntryVersionEditor
  mode: EditMode
  setMode?: (mode: EditMode) => void
}

export function EntryHeader({mode, setMode, versionEditor}: EntryHeaderProps) {
  const nav = useNav()
  const {schema} = useConfig()
  const {name: workspace} = useWorkspace()
  const root = useRoot()
  const currentLocale = useLocale()
  const navigate = useNavigate()
  const phase = versionEditor.phase
  const version = versionEditor.version
  const parent = version.parent
  const type = schema[version.type]
  const Icon = type && Type.meta(type).icon
  /*function handleDiscard() {
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
      {phase === EntryPhase.Draft && mode === EditMode.Editing && setMode && (
        <AppBar.Item
          as="button"
          icon={MdiSourceBranch}
          onClick={() => setMode(EditMode.Diff)}
        >
          <span>View changes</span>
        </AppBar.Item>
      )}
      {phase === EntryPhase.Draft && mode === EditMode.Diff && setMode && (
        <AppBar.Item
          as="button"
          icon={IcRoundEdit}
          onClick={() => setMode(EditMode.Editing)}
        >
          <span>Edit entry</span>
        </AppBar.Item>
      )}
      {phase === EntryPhase.Draft && (
        <AppBar.Item as="button" icon={IcRoundDelete}>
          <span>Discard</span>
        </AppBar.Item>
      )}
      {phase !== EntryPhase.Published && (
        <AppBar.Item as="button" icon={IcRoundPublish}>
          <span>Publish</span>
        </AppBar.Item>
      )}
    </AppBar.Root>
  )
}
