import {sql} from 'rado'
import {Store} from '../Store.js'

export function createEntrySearch(store: Store) {
  return store(
    sql`
      create virtual table if not exists EntrySearch using fts5(
        title, searchableText,
        content='Entry', 
        tokenize="unicode61 remove_diacritics 2 tokenchars '-_'"
      )
    `,
    sql`
      create trigger if not exists EntrySearch_ai 
        after insert on Entry begin
          insert into EntrySearch(
            rowid, title, searchableText
          ) values (
            new.rowid, new.title, new.searchableText
          );
        end
    `,
    sql`
      create trigger if not exists EntrySearch_ad 
        after delete on Entry begin
          insert into EntrySearch(
            EntrySearch, rowid, title, searchableText
          ) values(
            'delete', old.rowid, old.title, old.searchableText
          );
        end
    `,
    sql`
      create trigger if not exists EntrySearch_au
        after update on Entry begin
          insert into EntrySearch(
            EntrySearch, rowid, title, searchableText
          ) values(
            'delete', old.rowid, old.title, old.searchableText
          );
          insert into EntrySearch(
            rowid, title, searchableText
          ) values (
            new.rowid, new.title, new.searchableText
          );
        end
    `
  )
}
