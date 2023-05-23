import {Entry} from '../Entry.js'
import {Target} from './Target.js'

export interface Page extends Entry {}
export const Page = Target.create<Page>({})
