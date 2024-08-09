import {InferSelectModel, table} from 'rado'
import * as column from 'rado/universal/columns'

export const EntrySearch = table('EntrySearch', {
  title: column.text(),
  searchableText: column.text(),
  rank: column.integer()
})

export type EntrySearch = InferSelectModel<typeof EntrySearch>
