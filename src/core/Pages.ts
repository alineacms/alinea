import {Config, Schema} from 'alinea/core'
import {Callable} from 'rado/util/Callable'
import {Selection} from './pages/Selection.js'
import {serializeSelection} from './pages/Serialize.js'

export interface Pages extends Callable {
  <S>(select: S): Promise<Selection.Infer<S>>
}

export class Pages extends Callable {
  constructor(
    config: Config,
    fetch: <T>(selection: Selection<T>) => Promise<T>
  ) {
    const targets = Schema.targets(config.schema)
    super(async (select: any) => {
      const selection = Selection(select)
      serializeSelection(targets, selection)
      return fetch(selection)
    })
  }
}
