import {Config, Schema} from 'alinea/core'
import {Callable} from 'rado/util/Callable'
import {Selection} from './pages/Selection.js'

export interface Pages extends Callable {
  <S>(select: S): Promise<Selection.Infer<S>>
}

export class Pages extends Callable {
  constructor(
    config: Config,
    fetch: <T>(selection: Selection<T>) => Promise<T>
  ) {
    super(async (select: any) => {
      return fetch(applyTargets(config.schema, Selection(select)))
    })
  }
}

function applyTargets(schema: Schema, selection: Selection): Selection {
  throw new Error('todo')
  const targets = Schema.targets(schema)
  switch (selection.type) {
    case 'cursor':
  }
  return selection
}
