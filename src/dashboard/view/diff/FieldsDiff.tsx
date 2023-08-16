import {Shape} from 'alinea/core'
import {InputLabel} from 'alinea/editor'
import {VStack, fromModule} from 'alinea/ui'
import css from '../../../editor/view/Fields.module.scss'
import {FieldDiff} from './FieldDiff.js'

const styles = fromModule(css)

export type FieldsDiffProps = {
  changes: Array<[key: string, shape: Shape]>
  targetA: Record<string, any>
  targetB: Record<string, any>
}

export function FieldsDiff({changes, targetA, targetB}: FieldsDiffProps) {
  return (
    <div className={styles.root({border: true})}>
      <VStack gap={10}>
        {changes.map(([key, type], i) => {
          return (
            <div key={key}>
              <InputLabel label={type.label}>
                <FieldDiff
                  shape={type}
                  valueA={targetA?.[key]}
                  valueB={targetB?.[key]}
                />
              </InputLabel>
            </div>
          )
        })}
      </VStack>
    </div>
  )
}
