import {Value} from '@alinea/core'
import {ValueKind} from '@alinea/core/ValueKind'
import {px, Typo, VStack} from '@alinea/ui'
import {useMemo} from 'react'
import {equals} from './Equals'
import {FieldDiff} from './FieldDiff'

export type FieldsDiffProps = {
  types: Array<[key: string, value: Value]>
  targetA: Record<string, any>
  targetB: Record<string, any>
}

export function FieldsDiff({types, targetA, targetB}: FieldsDiffProps) {
  const changedFields = useMemo(() => {
    return types.filter(([key, type]) => {
      if (type.kind === ValueKind.Scalar) {
        return targetA[key] !== targetB[key]
      } else {
        return !equals(targetA[key], targetB[key])
      }
    })
  }, [types])
  if (changedFields.length === 0) return <>unchanged</>
  return (
    <VStack gap={10} style={{padding: px(10)}}>
      {changedFields.map(([key, type], i) => {
        return (
          <div key={key}>
            <Typo.H4>{key}</Typo.H4>
            <FieldDiff
              type={type}
              valueA={targetA[key]}
              valueB={targetB[key]}
            />
          </div>
        )
      })}
    </VStack>
  )
}
