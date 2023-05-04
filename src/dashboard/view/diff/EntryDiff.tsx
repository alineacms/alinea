import {Entry, Type} from 'alinea/core'
import {Chip, TextLabel, fromModule} from 'alinea/ui'
import {memo} from 'react'
import {useDashboard} from '../../hook/UseDashboard'
import {diffRecord} from './DiffUtils.js'
import css from './EntryDiff.module.scss'
import {FieldsDiff} from './FieldsDiff.js'

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
  const typeA = schema[entryA.type]!
  const typeB = schema[entryB.type]!
  const typeChanged = typeA !== typeB
  if (typeChanged)
    return (
      <div>
        <Chip>
          <TextLabel label={Type.label(typeA)} />
        </Chip>{' '}
        =&gt;
        <Chip>
          <TextLabel label={Type.label(typeB)} />
        </Chip>
      </div>
    )
  const changes = diffRecord(Type.shape(typeA), entryA, entryB)
  return (
    <div className={styles.root()}>
      <FieldsDiff changes={changes} targetA={entryA} targetB={entryB} />
    </div>
  )
})
