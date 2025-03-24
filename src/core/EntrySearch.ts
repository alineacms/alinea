import {type InferSelectModel, table} from 'rado'
import * as column from 'rado/universal/columns'

export const EntrySearch = table('EntrySearch', {
  title: column.text().notNull(),
  searchableText: column.text().notNull(),
  rank: column.integer().notNull(),
  rowid: column.integer().notNull()
})

export type EntrySearch = InferSelectModel<typeof EntrySearch>
