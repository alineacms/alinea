import {Collection} from 'helder.store'

export interface Draft {
  entry: string
  // Todo: store the binary instead of base64
  doc: string
}

export const Draft = new Collection<Draft & {id: string}>('Draft')
