import {fromModule} from '@alinea/ui'
import {diff_match_patch} from 'diff-match-patch'
import {useMemo} from 'react'
import css from './ScalarDiff.module.scss'

const styles = fromModule(css)

const matcher = new diff_match_patch()

export type ScalarDiffProps<T> = {
  valueA: T
  valueB: T
}

function toScalar(value: any) {
  if (typeof value === 'number') return String(value)
  return value ? String(value) : ''
}

export function ScalarDiff<T>({valueA, valueB}: ScalarDiffProps<T>) {
  const a = toScalar(valueA)
  const b = toScalar(valueB)
  const diffs = useMemo(() => {
    const res = matcher.diff_main(a, b)
    matcher.diff_cleanupSemantic(res)
    return res
  }, [a, b])
  return (
    <div className={styles.root()}>
      {diffs.length === 0 && <br />}
      {diffs.map(([op, text], i) => {
        return (
          <span
            key={i}
            className={styles.root.segment({
              insert: op === 1,
              delete: op === -1,
              equal: op === 0
            })}
          >
            {text}
          </span>
        )
      })}
    </div>
  )
}
