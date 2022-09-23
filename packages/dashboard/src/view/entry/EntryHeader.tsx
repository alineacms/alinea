import {EntryStatus} from '@alinea/core'
import {
  AppBar,
  Chip,
  fromModule,
  HStack,
  Stack,
  Typo,
  useObservable
} from '@alinea/ui'
import {IcRoundArchive} from '@alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from '@alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from '@alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPublish} from '@alinea/ui/icons/IcRoundPublish'
import {IcRoundRotateLeft} from '@alinea/ui/icons/IcRoundRotateLeft'
import {MdiSourceBranch} from '@alinea/ui/icons/MdiSourceBranch'
import {useState} from 'react'
import {useQueryClient} from 'react-query'
import {useNavigate} from 'react-router'
import {Link} from 'react-router-dom'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useWorkspace} from '../../hook/UseWorkspace'
import {EditMode} from './EditMode'
import css from './EntryHeader.module.scss'

const styles = fromModule(css)

function EntryStatusChip() {
  const nav = useNav()
  const drafts = useDrafts()
  const draftsStatus = useObservable(drafts.status)
  const draft = useCurrentDraft()
  const status = useObservable(draft.status)
  switch (status) {
    case EntryStatus.Published:
      return <Chip icon={IcRoundCheck}>Published</Chip>
    case EntryStatus.Publishing:
      return <Chip icon={IcRoundRotateLeft}>Publishing</Chip>
    case EntryStatus.Draft:
      return (
        <Link to={nav.draft(draft)} style={{textDecoration: 'none'}}>
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
        </Link>
      )
    case EntryStatus.Archived:
      return <Chip icon={IcRoundArchive}>Archived</Chip>
  }
}

export type EntryHeaderProps = {
  mode: EditMode
  setMode?: (mode: EditMode) => void
}

export function EntryHeader({mode, setMode}: EntryHeaderProps) {
  const nav = useNav()
  const {name: workspace, schema} = useWorkspace()
  const root = useRoot()
  const drafts = useDrafts()
  const draft = useCurrentDraft()
  const currentLocale = useLocale()
  const navigate = useNavigate()
  const parent = draft.alinea.parent
  const type = schema.type(draft.type)
  const status = useObservable(draft.status)
  const queryClient = useQueryClient()
  const [isPublishing, setPublishing] = useState(false)
  function handleDiscard() {
    return drafts.discard(draft).then(([entryRemains, err]) => {
      ueryClient.invalidateQueries(['draft', draft.id])
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
  }
  return (
    <AppBar.Root>
      <AppBar.Item full style={{flexGrow: 1}}>
        <Typo.Monospace className={styles.root.url()}>
          <HStack gap={8} center>
            <div style={{flexShrink: 0}}>
              {type?.options.icon ? (
                <type.options.icon />
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
              {draft.url}
            </span>
          </HStack>
        </Typo.Monospace>
      </AppBar.Item>
      {root.i18n && (
        <HStack center gap={8}>
          {root.i18n.locales.map(locale => {
            const translation = draft.translation(locale)
            const link = translation || draft
            return (
              <Link
                key={locale}
                to={nav.entry({
                  workspace: link.alinea.workspace,
                  root: link.alinea.root,
                  id: link.id,
                  locale
                })}
              >
                <Chip accent={currentLocale === locale}>
                  {translation ? (
                    <>{locale.toUpperCase()}: ✅</>
                  ) : (
                    <>{locale.toUpperCase()}: ❌</>
                  )}
                </Chip>
              </Link>
            )
          })}
        </HStack>
      )}
      <Stack.Right>
        <AppBar.Item>
          <EntryStatusChip />
        </AppBar.Item>
      </Stack.Right>
      {status === EntryStatus.Draft && mode === EditMode.Editing && setMode && (
        <AppBar.Item
          as="button"
          icon={MdiSourceBranch}
          onClick={() => setMode(EditMode.Diff)}
        >
          <span>View changes</span>
        </AppBar.Item>
      )}
      {status === EntryStatus.Draft && mode === EditMode.Diff && setMode && (
        <AppBar.Item
          as="button"
          icon={IcRoundEdit}
          onClick={() => setMode(EditMode.Editing)}
        >
          <span>Edit entry</span>
        </AppBar.Item>
      )}
      {status === EntryStatus.Draft && (
        <AppBar.Item as="button" icon={IcRoundDelete} onClick={handleDiscard}>
          <span>Discard</span>
        </AppBar.Item>
      )}
      {status !== EntryStatus.Published && !isPublishing && (
        <AppBar.Item as="button" icon={IcRoundPublish} onClick={handlePublish}>
          <span>Publish</span>
        </AppBar.Item>
      )}
    </AppBar.Root>
  )
}
