import styler from '@alinea/styler'
import type {Entry} from 'alinea/core/Entry'
import {Type} from 'alinea/core/Type'
import {Chip, TextLabel} from 'alinea/ui'
import {useConfig} from '../../hook/UseConfig.js'
import {useTranslation} from '../../hook/useTranslation.js'
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
        {'=>'}
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
