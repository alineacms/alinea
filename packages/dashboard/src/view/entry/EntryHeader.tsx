import {EntryStatus} from '@alinea/core'
import {AppBar, Chip, HStack, px, Stack, Typo, useObservable} from '@alinea/ui'
import {useState} from 'react'
import {
  MdArchive,
  MdCheck,
  MdDelete,
  MdEdit,
  MdInsertDriveFile,
  MdPublish,
  MdRotateLeft
} from 'react-icons/md'
import {useQueryClient} from 'react-query'
import {useNavigate} from 'react-router'
import {Link} from 'react-router-dom'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useWorkspace} from '../../hook/UseWorkspace'

function EntryStatusChip() {
  const drafts = useDrafts()
  const draftsStatus = useObservable(drafts.status)
  const draft = useCurrentDraft()
  const status = useObservable(draft.status)
  switch (status) {
    case EntryStatus.Published:
      return <Chip icon={MdCheck}>Published</Chip>
    case EntryStatus.Publishing:
      return <Chip icon={MdRotateLeft}>Publishing</Chip>
    case EntryStatus.Draft:
      return (
        <Chip
          accent
          icon={
            draftsStatus === DraftsStatus.Saving
              ? MdRotateLeft
              : draftsStatus === DraftsStatus.Synced
              ? MdCheck
              : MdEdit
          }
        >
          Draft
        </Chip>
      )
    case EntryStatus.Archived:
      return <Chip icon={MdArchive}>Archived</Chip>
  }
}

export function EntryHeader() {
  const nav = useNav()
  const {name: workspace, schema} = useWorkspace()
  const root = useRoot()
  const drafts = useDrafts()
  const draft = useCurrentDraft()
  const currentLocale = useLocale()
  const navigate = useNavigate()
  const parent = draft.parent
  const type = schema.type(draft.type)
  const status = useObservable(draft.status)
  const queryClient = useQueryClient()
  const [isPublishing, setPublishing] = useState(false)
  function handleDiscard() {
    return drafts.discard(draft).then(([entryRemains, err]) => {
      queryClient.invalidateQueries(['draft', draft.id])
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
          draft.workspace,
          draft.root,
          draft.parent
        ])
      })
      .finally(() => {
        setPublishing(false)
      })
  }
  return (
    <AppBar.Root>
      <AppBar.Item full style={{flexGrow: 1}}>
        <Typo.Monospace
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            background: 'var(--highlight)',
            padding: `${px(6)} ${px(15)}`,
            borderRadius: px(8)
          }}
        >
          <HStack gap={8} center>
            <div style={{flexShrink: 0}}>
              {type?.options.icon ? (
                <type.options.icon />
              ) : (
                <MdInsertDriveFile size={12} style={{display: 'block'}} />
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
                  workspace: link.workspace,
                  root: link.root,
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
      {status === EntryStatus.Draft && (
        <AppBar.Item as="button" icon={MdDelete} onClick={handleDiscard}>
          <span>Discard</span>
        </AppBar.Item>
      )}
      {status !== EntryStatus.Published && !isPublishing && (
        <AppBar.Item as="button" icon={MdPublish} onClick={handlePublish}>
          <span>Publish</span>
        </AppBar.Item>
      )}
    </AppBar.Root>
  )
}
