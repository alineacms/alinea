import styler from '@alinea/styler'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {Chip, TextLabel} from '#/ui.js'
import {useConfig} from '../../hook/UseConfig.js'
import {diffRecord} from './DiffUtils.js'
import css from './EntryDiff.module.scss'
import {FieldsDiff} from './FieldsDiff.js'

const styles = styler(css)

export type EntryDiffProps = {
  entryA: Entry
  entryB: Entry
}

export function EntryDiff({entryA, entryB}: EntryDiffProps) {
  const {schema} = useConfig()
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
  const changes = diffRecord(Type.shape(typeA), entryA.data, entryB.data)
  return (
    <div className={styles.root()}>
      <FieldsDiff
        changes={changes}
        targetA={entryA.data}
        targetB={entryB.data}
      />
    </div>
  )
}
