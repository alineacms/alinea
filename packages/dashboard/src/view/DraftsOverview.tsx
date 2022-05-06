import {Entry, Outcome} from '@alinea/core'
import {
  Button,
  Card,
  Chip,
  fromModule,
  HStack,
  Icon,
  IconButton,
  IconLink,
  Stack,
  TextLabel,
  Typo,
  VStack
} from '@alinea/ui'
import {Badge} from '@alinea/ui/Badge'
import IcRoundAddCircleOutline from '@alinea/ui/icons/IcRoundAddCircleOutline'
import IcRoundArrowForward from '@alinea/ui/icons/IcRoundArrowForward'
import IcRoundClose from '@alinea/ui/icons/IcRoundClose'
import {IcRoundEdit} from '@alinea/ui/icons/IcRoundEdit'
import IcRoundKeyboardArrowDown from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from '@alinea/ui/icons/IcRoundKeyboardArrowRight'
import {memo, useState} from 'react'
import {useQuery} from 'react-query'
import {useDraftsList} from '../hook/UseDraftsList'
import {useNav} from '../hook/UseNav'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {diffRecord} from './diff/DiffUtils'
import {FieldsDiff} from './diff/FieldsDiff'
import css from './DraftsOverview.module.scss'

const styles = fromModule(css)

type EntryDiffProps = {
  entryA: Entry
  entryB: Entry
}

const EntryDiff = memo(function EntryDiff({entryA, entryB}: EntryDiffProps) {
  const workspace = useWorkspace()
  const typeA = workspace.schema.type(entryA.type)!
  const typeB = workspace.schema.type(entryB.type)!
  const typeChanged = typeA !== typeB
  if (typeChanged)
    return (
      <div>
        <Chip>
          <TextLabel label={typeA.label} />
        </Chip>{' '}
        =&gt;
        <Chip>
          <TextLabel label={typeB.label} />
        </Chip>
      </div>
    )
  const changes = diffRecord(typeA.valueType, entryA, entryB)
  return (
    <div className={styles.diff()}>
      <FieldsDiff changes={changes} targetA={entryA} targetB={entryB} />
    </div>
  )
})

type DraftDetailProps = {
  original: Entry | undefined
  draft: Entry
}

function DraftDetail({draft, original}: DraftDetailProps) {
  const workspace = useWorkspace()
  const nav = useNav()
  const hasChanges = Boolean(original)
  const [isOpen, setIsOpen] = useState(false)
  const type = workspace.schema.type(draft.type)
  const changes =
    hasChanges && type && diffRecord(type.valueType, original, draft).length
  return (
    <Card.Root key={draft.id}>
      <Card.Header>
        <HStack
          center
          gap={6}
          style={{flexGrow: 1, cursor: hasChanges ? 'pointer' : undefined}}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div>
            {hasChanges ? (
              <Icon
                size={20}
                icon={
                  isOpen ? IcRoundKeyboardArrowDown : IcRoundKeyboardArrowRight
                }
              />
            ) : (
              <Icon size={20} icon={IcRoundAddCircleOutline} />
            )}
          </div>
          <Badge amount={Number(changes)} right={-16} top={0}>
            <Typo.H2 flat>
              <TextLabel label={draft.title} />
            </Typo.H2>
          </Badge>
        </HStack>
        <Card.Options>
          <IconLink to={nav.entry(draft)} icon={IcRoundEdit} />
        </Card.Options>
        <Card.Options>
          <IconButton icon={IcRoundClose} />
        </Card.Options>
      </Card.Header>
      {original && isOpen && (
        <Card.Content>
          <EntryDiff entryA={original} entryB={draft} />
        </Card.Content>
      )}
    </Card.Root>
  )
}

export function DraftsOverview() {
  const {hub} = useSession()
  const workspace = useWorkspace()
  const {ids} = useDraftsList(workspace.name)
  const {data} = useQuery(
    ['drafts-overview', ids],
    () => {
      const criteria = Entry.where(Entry.id.isIn(ids)).where(
        Entry.workspace.is(workspace.name)
      )
      const drafts = hub.query(criteria).then(Outcome.unpack)
      const source = hub.query(criteria, {source: true}).then(Outcome.unpack)
      return Promise.all([drafts, source]).then(([drafts, source]) => ({
        drafts,
        source
      }))
    },
    {suspense: true}
  )
  const {drafts, source} = data!
  return (
    <div className={styles.root()}>
      <div className={styles.root.inner()}>
        <HStack center full className={styles.root.header()}>
          <Typo.H1 flat>Drafts</Typo.H1>
          <Stack.Right>
            <Button iconRight={IcRoundArrowForward}>Publish all</Button>
          </Stack.Right>
        </HStack>
        <VStack gap={20} className={styles.root.list()}>
          {drafts.map((draft, i) => {
            const original = source.find(entry => entry.id === draft.id)
            return <DraftDetail key={i} original={original} draft={draft} />
          })}
        </VStack>
      </div>
    </div>
  )
}
