import {index, InferSelectModel, primaryKey, sql, Sql, table} from 'rado'
import {Functions} from 'rado/core/expr/Functions'
import {input, Input} from 'rado/core/expr/Input'
import * as column from 'rado/universal/columns'
import {createId} from './Id.js'

export enum EntryPhase {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived'
}

export const ALT_STATUS: Array<EntryPhase> = [
  EntryPhase.Draft,
  EntryPhase.Archived
]

export type EntryLinks = {[field: string]: Array<string>}

export const EntryRow = table(
  'Entry',
  {
    // Entry data
    id: column.text().$default(createId),
    phase: column.text().notNull().$type<EntryPhase>(),
    title: column.text().notNull(),
    type: column.text().notNull(),
    seeded: column.text(),

    // Hierarchy
    workspace: column.text().notNull(),
    root: column.text().notNull(),

    index: column.text().notNull(),
    parent: column.text(),

    // I18n
    i18nId: column.text().notNull(),
    locale: column.text(),

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
      primary: primaryKey(EntryRow.id, EntryRow.phase),
      rowHash: index().on(EntryRow.rowHash),
      type: index().on(EntryRow.type),
      parent: index().on(EntryRow.parent),
      url: index().on(EntryRow.url),
      path: index().on(EntryRow.path),
      fileIdentifier: index().on(
        EntryRow.filePath,
        EntryRow.workspace,
        EntryRow.root
      ),
      parentDir: index().on(EntryRow.parentDir),
      childrenDir: index().on(EntryRow.childrenDir),
      // versionId: index().on(EntryRow.versionId),
      phase: index().on(EntryRow.phase),
      i18nId: index().on(EntryRow.i18nId)
    }
  }
)

export function concat(...slices: Array<Input<string | null>>) {
  return sql.universal({
    mysql: Functions.concat(...slices),
    default: sql.join(slices.map(input), sql` || `)
  }) as Sql<string>
}

export function entryVersionId(entry = EntryRow) {
  return concat(entry.id, sql.value('.'), entry.phase)
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
