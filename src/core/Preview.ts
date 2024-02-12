import {Entry} from 'alinea/core'
import {ComponentType} from 'react'

export type Preview =
  | string
  | ComponentType<{entry: Entry; previewToken: string}>
