import {EntryStatus} from '@alinea/core'
import {useCurrentDraft} from '@alinea/editor'
import {AppBar, Chip, px, Stack, Typo, useObservable} from '@alinea/ui'
import {useState} from 'react'
import {
  MdArchive,
  MdCheck,
  MdDelete,
  MdEdit,
  MdPublish,
  MdRotateLeft
} from 'react-icons/md'
import {useQueryClient} from 'react-query'
import {DraftsStatus, useDrafts} from '../../hook/UseDrafts'

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
  const drafts = useDrafts()
  const draft = useCurrentDraft()
  const status = useObservable(draft.status)
  const queryClient = useQueryClient()
  const [isPublishing, setPublishing] = useState(false)
  function handleDiscard() {
    return drafts.discard(draft).then(() => {
      queryClient.invalidateQueries(['draft', draft.id])
    })
  }
  function handlePublish() {
    setPublishing(true)
    return drafts
      .publish(draft)
      .then(() => {
        queryClient.invalidateQueries(['children', draft.$parent])
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
            display: 'block',
            width: '100%',
            background: 'var(--highlight)',
            padding: `${px(6)} ${px(15)}`,
            borderRadius: px(8)
          }}
        >
          {draft.url}
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
