import type {Shape} from '#/core/Shape.js'
import {InputLabel} from '#/dashboard/view/InputLabel.js'
import {VStack} from '#/ui.js'
import {Lift} from '#/ui/Lift.js'
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
