export interface EntryUrlConflictErrorInfo {
  url: string
  entryId: string
  workspace: string
  root: string
  /** Set when the URL is used by another language of the same entry */
  locale?: string | null
  /**
   * Set when the URL is an alias: of the entry being published (`candidate`)
   * or of the entry that already uses it (`existing`), or of both when it's
   * not clear which translation it belongs to (`shared`)
   */
  alias?: 'candidate' | 'existing' | 'shared'
}

/** What an editor should do to resolve the conflict */
export function urlConflictResolution(info: EntryUrlConflictErrorInfo): string {
  const translation =
    info.locale === undefined
      ? undefined
      : `the ${info.locale ?? 'untranslated'} translation of this entry`
  switch (info.alias) {
    case 'candidate':
      return `Remove the URL alias "${info.url}" from this translation.`
    case 'existing':
      return `Remove the URL alias "${info.url}" from ${translation ?? `entry ${info.entryId}`}.`
    case 'shared':
      return `Remove the URL alias "${info.url}" from the translation it doesn't belong to: this one or ${translation ?? `entry ${info.entryId}`}.`
    default:
      return 'Change the entry path or remove this URL alias.'
  }
}

export class EntryUrlConflictError extends Error {
  name = 'EntryUrlConflictError'

  constructor(public info: EntryUrlConflictErrorInfo) {
    const owner =
      info.locale === undefined
        ? `entry ${info.entryId} in workspace "${info.workspace}", root "${info.root}"`
        : `the ${info.locale ?? 'untranslated'} translation of this entry`
    super(
      `URL "${info.url}" is already defined by ${owner}. ${urlConflictResolution(info)} Then publish again.`
    )
  }
}
