export type LoadResult<Value> =
  | [value: Value, error: null]
  | [value: null, error: Error]

export type BatchLoad<Value> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<LoadResult<Value>>>

export function batchLoader<Value>(load: BatchLoad<Value>) {
  let batch: Array<{
    key: string
    resolve: (value: LoadResult<Value>) => void
  }> = []
  return (key: string): Promise<LoadResult<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const keys = [...new Set(current.map(item => item.key))]
            const result = await load(keys)
            const byKey = new Map(
              keys.map((key, index) => [key, result[index]] as const)
            )
            for (const item of current) {
              item.resolve(
                byKey.get(item.key) ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
            }
          } catch (error) {
            const reason =
              error instanceof Error ? error : new Error(String(error))
            for (const item of current) item.resolve([null, reason])
          }
        })
      }
    })
  }
}
