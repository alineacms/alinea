import {Shape} from 'alinea/core'
import {TextLabel, Typo, VStack} from 'alinea/ui'
import {FieldDiff} from './FieldDiff.js'

export type FieldsDiffProps = {
  changes: Array<[key: string, shape: Shape]>
  targetA: Record<string, any>
  targetB: Record<string, any>
}

export function FieldsDiff({changes, targetA, targetB}: FieldsDiffProps) {
  return (
    <VStack gap={10}>
      {changes.map(([key, type], i) => {
        return (
          <div key={key}>
            <Typo.H4>
              <TextLabel label={type.label} />
            </Typo.H4>
            <FieldDiff
              shape={type}
              valueA={targetA?.[key]}
              valueB={targetB?.[key]}
            />
          </div>
        )
      })}
    </VStack>
  )
}
