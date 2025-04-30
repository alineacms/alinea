import {
  type InferSelectModel,
  type Sql,
  index,
  primaryKey,
  sql,
  table
} from 'rado'
import {column as createColumn} from 'rado/core/Column'
import {Functions} from 'rado/core/expr/Functions'
import {type Input, input} from 'rado/core/expr/Input'
import * as column from 'rado/universal/columns'
import type {EntryStatus} from './Entry.js'
import {createId} from './Id.js'

export const ALT_STATUS: Array<EntryStatus> = ['draft', 'archived']

export type EntryLinks = {[field: string]: Array<string>}

function nocaseText() {
  return createColumn<string | null>({
    type: sql`text collate nocase`
  })
}

export const EntryRow = table(
  'Entry',
  {
    // Entry data
    id: column.text().$default(createId),
    status: column.text().notNull().$type<EntryStatus>(),
    title: column.text().notNull(),
    type: column.text().notNull(),
    seeded: column.text(),

    // Hierarchy
    workspace: column.text().notNull(),
    root: column.text().notNull(),

    index: column.text().notNull(),
    parentId: column.text(),

    locale: nocaseText(),

    // Entries from which a new draft can be created are marked as active,
    // there is only one active entry per entryId
    active: column.boolean().notNull(),
    // Per entry there is one main entry, which is either published, archived or
    // draft
    main: column.boolean().notNull(),

    path: column.text().notNull(),
    data: column.json().notNull().$type<any>(),

    // Computed
    level: column.integer().notNull(), // Amount of parents
    filePath: column.text().notNull(), // Filesystem location
    parentDir: column.text().notNull(), // Filesystem location
    childrenDir: column.text().notNull(), // Filesystem location

    rowHash: column.text().notNull(),
    fileHash: column.text().notNull(),
    url: column.text().notNull(),
    searchableText: column.text().notNull()
  },
  EntryRow => {
    return {
      primary: primaryKey(EntryRow.id, EntryRow.locale, EntryRow.status),
      rowHash: index().on(EntryRow.rowHash),
      type: index().on(EntryRow.type),
      parent: index().on(EntryRow.parentId),
      url: index().on(EntryRow.url),
      path: index().on(EntryRow.path),
      fileIdentifier: index().on(
        EntryRow.filePath,
        EntryRow.workspace,
        EntryRow.root
      ),
      parentDir: index().on(EntryRow.parentDir),
      childrenDir: index().on(EntryRow.childrenDir)
    }
  }
)

export function concat(...slices: Array<Input<string | null>>) {
  return sql.universal({
    mysql: Functions.concat(...slices),
    default: sql.join(slices.map(input), sql` || `)
  }) as Sql<string>
}

/**
 * Represents an Entry row in the database,
 * field data is available in the data column in JSON format.
 */
export type EntryRow<Data = Record<string, any>> = InferSelectModel<
  typeof EntryRow
> & {
  data: Data
}
