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
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useDashboard} from '../../hook/UseDashboard'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts'
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
  const {nav} = useDashboard()
  const {name: workspace, schema} = useWorkspace()
  const {name: root} = useRoot()
  const drafts = useDrafts()
  const draft = useCurrentDraft()
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
        queryClient.invalidateQueries(['tree', workspace, root])
        // Navigate to parent, otherwise we'll 404
        navigate(nav.entry(workspace, root, parent))
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
