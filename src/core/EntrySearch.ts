import {column, table} from 'rado'

export const EntrySearch = table({
  EntrySearch: class {
    title = column.string
    searchableText = column.string
  }
})

export type EntrySearch = table<typeof EntrySearch>
