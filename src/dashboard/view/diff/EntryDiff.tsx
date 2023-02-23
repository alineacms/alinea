import {Entry} from 'alinea/core'
import {Chip, fromModule, TextLabel} from 'alinea/ui'
import {memo} from 'react'
import {useDashboard} from '../../hook/UseDashboard'
import {diffRecord} from './DiffUtils'
import css from './EntryDiff.module.scss'
import {FieldsDiff} from './FieldsDiff'

const styles = fromModule(css)

export type EntryDiffProps = {
  entryA: Entry
  entryB: Entry
}

export const EntryDiff = memo(function EntryDiff({
  entryA,
  entryB
}: EntryDiffProps) {
  const {schema} = useDashboard().config
  const typeA = schema.type(entryA.type)!
  const typeB = schema.type(entryB.type)!
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
  const changes = diffRecord(typeA.shape, entryA, entryB)
  return (
    <div className={styles.root()}>
      <FieldsDiff changes={changes} targetA={entryA} targetB={entryB} />
    </div>
  )
})
