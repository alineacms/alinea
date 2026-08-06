import type {EntryStatus} from '#/core/Entry.js'

export type EntryHeaderActionId =
  | 'remove-draft'
  | 'replace'
  | 'unpublish'
  | 'archive'
  | 'publish'
  | 'delete'

export type EntryHeaderPrimaryActionId =
  | 'create-draft'
  | 'save-translation'
  | 'discard-changes'
  | 'publish-edits'
  | 'save-draft'
  | 'publish-draft'

interface EntryHeaderAccess {
  archive: boolean
  delete: boolean
  publish: boolean
  update: boolean
  upload: boolean
}

export interface EntryHeaderActionState {
  access: EntryHeaderAccess
  activeStatus: EntryStatus
  canDelete: boolean
  canPublishParents: boolean
  draftsEnabled: boolean
  isDirty: boolean
  isMediaFile: boolean
  isMediaLibrary: boolean
  isParentUnpublished: boolean
  isRevision: boolean
  isUnpublished: boolean
  untranslated: boolean
}

export interface EntryHeaderPrimaryActionState {
  access: Pick<EntryHeaderAccess, 'publish' | 'update'>
  activeStatus: EntryStatus
  canPublishParents: boolean
  canSaveDraft: boolean
  isDirty: boolean
  isRevision: boolean
  parentNeedsTranslation: boolean
  untranslated: boolean
}

export function entryHeaderPrimaryActionIds({
  access,
  activeStatus,
  canPublishParents,
  canSaveDraft,
  isDirty,
  isRevision,
  parentNeedsTranslation,
  untranslated
}: EntryHeaderPrimaryActionState): Array<EntryHeaderPrimaryActionId> {
  if (isRevision) return canSaveDraft ? ['create-draft'] : []
  if (untranslated) {
    return !parentNeedsTranslation && access.update ? ['save-translation'] : []
  }
  if (isDirty) {
    const actions: Array<EntryHeaderPrimaryActionId> = ['discard-changes']
    if (access.publish) actions.push('publish-edits')
    if (canSaveDraft) actions.push('save-draft')
    return actions
  }
  if (activeStatus === 'draft' && canPublishParents && access.publish)
    return ['publish-draft']
  return []
}

export function entryHeaderActionIds({
  access,
  activeStatus,
  canDelete,
  canPublishParents,
  draftsEnabled,
  isDirty,
  isMediaFile,
  isMediaLibrary,
  isParentUnpublished,
  isRevision,
  isUnpublished,
  untranslated
}: EntryHeaderActionState): Array<EntryHeaderActionId> {
  if (isRevision || isDirty || untranslated) return []

  if (activeStatus === 'draft') {
    if (!isUnpublished) return access.update ? ['remove-draft'] : []
    if (isParentUnpublished) {
      return canDelete && access.delete ? ['delete'] : []
    }
    return access.archive ? ['archive'] : []
  }

  if (activeStatus === 'published') {
    if (isMediaFile) {
      const actions: Array<EntryHeaderActionId> = []
      if (access.update && access.upload) actions.push('replace')
      if (canDelete && access.delete) actions.push('delete')
      return actions
    }

    const actions: Array<EntryHeaderActionId> = []
    if (!isMediaLibrary && draftsEnabled && access.publish)
      actions.push('unpublish')
    if (canDelete && access.archive) actions.push('archive')
    return actions
  }

  const actions: Array<EntryHeaderActionId> = []
  if (canPublishParents && access.publish) actions.push('publish')
  if (canDelete && access.delete) actions.push('delete')
  return actions
}
