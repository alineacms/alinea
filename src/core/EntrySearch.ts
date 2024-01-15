import {column, table} from 'rado'

export const EntrySearch = table({
  EntrySearch: class {
    title = column.string
    searchableText = column.string
    rank = column.number
  }
})

export type EntrySearch = table<typeof EntrySearch>
