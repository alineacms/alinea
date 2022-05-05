import {Entry, Outcome} from '@alinea/core'
import {
  Button,
  Card,
  Chip,
  fromModule,
  HStack,
  IconButton,
  Stack,
  TextLabel,
  Typo
} from '@alinea/ui'
import IcRoundCheckBoxOutlineBlank from '@alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import IcRoundClose from '@alinea/ui/icons/IcRoundClose'
import {IcRoundEdit} from '@alinea/ui/icons/IcRoundEdit'
import {memo} from 'react'
import {useQuery} from 'react-query'
import {useDraftsList} from '../hook/UseDraftsList'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
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
  return (
    <div>
      <FieldsDiff
        types={Object.entries(typeA.valueType.shape)}
        targetA={entryA}
        targetB={entryB}
      />
    </div>
  )
})

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
            <Button>Publish all</Button>
          </Stack.Right>
        </HStack>
        <div className={styles.root.list()}>
          <Card.Root>
            {drafts.map((draft, i) => {
              const original = source.find(entry => entry.id === draft.id)
              return (
                <Card.Row key={draft.id}>
                  <Card.Header>
                    <Card.Options>
                      <IcRoundCheckBoxOutlineBlank />
                    </Card.Options>
                    <Card.Title>
                      <TextLabel label={draft.title} />
                    </Card.Title>
                    <Card.Options>
                      <IconButton icon={IcRoundEdit} />
                    </Card.Options>
                    <Card.Options>
                      <IconButton icon={IcRoundClose} />
                    </Card.Options>
                  </Card.Header>
                  <Card.Content>
                    {original ? (
                      <EntryDiff entryA={original} entryB={draft} />
                    ) : (
                      'created'
                    )}
                  </Card.Content>
                </Card.Row>
              )
            })}
          </Card.Root>
        </div>
      </div>
    </div>
  )
}
