import type {EntryStatus} from '#/core/Entry.js'

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

export interface EntryDirtyActions {
  publish: boolean
  saveDraft: boolean
}

export interface EntryHeaderPrimaryActions {
  createDraft: boolean
  dirty: EntryDirtyActions | undefined
  publishDraft: boolean
  saveTranslation: boolean
}

export interface EntryHeaderActions {
  archive: boolean
  delete: boolean
  publish: boolean
  removeDraft: boolean
  replace: boolean
  unpublish: boolean
}

export function entryDirtyActions(
  canPublish: boolean,
  canSaveDraft: boolean
): EntryDirtyActions {
  return {publish: canPublish, saveDraft: canSaveDraft}
}

export function entryHeaderPrimaryActions({
  access,
  activeStatus,
  canPublishParents,
  canSaveDraft,
  isDirty,
  isRevision,
  parentNeedsTranslation,
  untranslated
}: EntryHeaderPrimaryActionState): EntryHeaderPrimaryActions {
  const actions: EntryHeaderPrimaryActions = {
    createDraft: false,
    dirty: undefined,
    publishDraft: false,
    saveTranslation: false
  }
  if (isRevision) {
    actions.createDraft = canSaveDraft
    return actions
  }
  if (untranslated) {
    actions.saveTranslation = !parentNeedsTranslation && access.update
    return actions
  }
  if (isDirty) {
    actions.dirty = entryDirtyActions(access.publish, canSaveDraft)
    return actions
  }
  if (activeStatus === 'draft' && canPublishParents && access.publish)
    actions.publishDraft = true
  return actions
}

export function entryHeaderActions({
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
}: EntryHeaderActionState): EntryHeaderActions {
  const actions: EntryHeaderActions = {
    archive: false,
    delete: false,
    publish: false,
    removeDraft: false,
    replace: false,
    unpublish: false
  }
  if (isRevision || isDirty || untranslated) return actions

  if (activeStatus === 'draft') {
    if (!isUnpublished) {
      actions.removeDraft = access.update
      return actions
    }
    if (isParentUnpublished) {
      actions.delete = canDelete && access.delete
      return actions
    }
    actions.archive = access.archive
    return actions
  }

  if (activeStatus === 'published') {
    if (isMediaFile) {
      actions.replace = access.update && access.upload
      actions.delete = canDelete && access.delete
      return actions
    }

    actions.unpublish = !isMediaLibrary && draftsEnabled && access.publish
    actions.archive = canDelete && access.archive
    return actions
  }

  actions.publish = canPublishParents && access.publish
  actions.delete = canDelete && access.delete
  return actions
}
