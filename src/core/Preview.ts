import {Entry} from 'alinea/core/Entry'
import {ComponentType} from 'react'

export type Preview = boolean | ComponentType<{entry: Entry}>
