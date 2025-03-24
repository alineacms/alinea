import type {Shape} from 'alinea/core/Shape'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {VStack} from 'alinea/ui'
import {Lift} from 'alinea/ui/Lift'
import {FieldDiff} from './FieldDiff.js'

export type FieldsDiffProps = {
  changes: Array<[key: string, shape: Shape]>
  targetA: Record<string, any>
  targetB: Record<string, any>
}

export function FieldsDiff({changes, targetA, targetB}: FieldsDiffProps) {
  return (
    <Lift>
      <VStack gap={10}>
        {changes.map(([key, type], i) => {
          return (
            <div key={key}>
              <InputLabel label={type.label}>
                <FieldDiff
                  FieldsDiff={FieldsDiff}
                  shape={type}
                  valueA={targetA?.[key]}
                  valueB={targetB?.[key]}
                />
              </InputLabel>
            </div>
          )
        })}
      </VStack>
    </Lift>
  )
}
