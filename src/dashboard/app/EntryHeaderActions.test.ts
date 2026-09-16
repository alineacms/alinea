import {describe, expect, test} from 'bun:test'
import {
  entryDirtyActions,
  entryHeaderActions,
  entryHeaderPrimaryActions,
  type EntryHeaderActions,
  type EntryHeaderActionState,
  type EntryHeaderPrimaryActions,
  type EntryHeaderPrimaryActionState
} from './EntryHeaderActions.js'

const base: EntryHeaderActionState = {
  access: {
    archive: true,
    delete: true,
    publish: true,
    update: true,
    upload: true
  },
  activeStatus: 'published',
  canDelete: true,
  canPublishParents: true,
  draftsEnabled: true,
  isDirty: false,
  isMediaFile: false,
  isMediaLibrary: false,
  isParentUnpublished: false,
  isRevision: false,
  isUnpublished: false,
  untranslated: false
}

interface ActionCase {
  expected: Partial<EntryHeaderActions>
  name: string
  state: Partial<EntryHeaderActionState>
}

const noActions: EntryHeaderActions = {
  archive: false,
  delete: false,
  publish: false,
  removeDraft: false,
  replace: false,
  unpublish: false
}

const cases: Array<ActionCase> = [
  {
    name: 'hides actions for a revision',
    state: {isRevision: true},
    expected: {}
  },
  {
    name: 'hides actions while dirty',
    state: {isDirty: true},
    expected: {}
  },
  {
    name: 'hides actions for an untranslated entry',
    state: {untranslated: true},
    expected: {}
  },
  {
    name: 'only removes a regular draft',
    state: {activeStatus: 'draft'},
    expected: {removeDraft: true}
  },
  {
    name: 'does not remove a draft without update access',
    state: {
      access: {...base.access, update: false},
      activeStatus: 'draft'
    },
    expected: {}
  },
  {
    name: 'deletes an unpublished entry only below an unpublished parent',
    state: {
      activeStatus: 'draft',
      isParentUnpublished: true,
      isUnpublished: true
    },
    expected: {delete: true}
  },
  {
    name: 'does not delete a seeded unpublished entry',
    state: {
      activeStatus: 'draft',
      canDelete: false,
      isParentUnpublished: true,
      isUnpublished: true
    },
    expected: {}
  },
  {
    name: 'archives an unpublished entry below a published parent',
    state: {activeStatus: 'draft', isUnpublished: true},
    expected: {archive: true}
  },
  {
    name: 'offers unpublish and archive for a published entry',
    state: {},
    expected: {archive: true, unpublish: true}
  },
  {
    name: 'does not offer delete directly for a published entry',
    state: {access: {...base.access, archive: false, publish: false}},
    expected: {}
  },
  {
    name: 'does not unpublish when drafts are disabled',
    state: {draftsEnabled: false},
    expected: {archive: true}
  },
  {
    name: 'does not unpublish a media library',
    state: {isMediaLibrary: true},
    expected: {archive: true}
  },
  {
    name: 'replaces or deletes a published media file',
    state: {isMediaFile: true},
    expected: {delete: true, replace: true}
  },
  {
    name: 'does not archive a published media file',
    state: {
      access: {...base.access, delete: false, update: false},
      isMediaFile: true
    },
    expected: {}
  },
  {
    name: 'does not archive a seeded published entry',
    state: {canDelete: false},
    expected: {unpublish: true}
  },
  {
    name: 'publishes or deletes an archived entry',
    state: {activeStatus: 'archived'},
    expected: {delete: true, publish: true}
  },
  {
    name: 'does not publish an archived entry with unpublishable parents',
    state: {activeStatus: 'archived', canPublishParents: false},
    expected: {delete: true}
  }
]

describe('entryHeaderActions', () => {
  for (const actionCase of cases) {
    test(actionCase.name, () => {
      expect(entryHeaderActions({...base, ...actionCase.state})).toEqual({
        ...noActions,
        ...actionCase.expected
      })
    })
  }
})

const primaryBase: EntryHeaderPrimaryActionState = {
  access: {publish: true, update: true},
  activeStatus: 'published',
  canPublishParents: true,
  canSaveDraft: true,
  isDirty: false,
  isRevision: false,
  parentNeedsTranslation: false,
  untranslated: false
}

interface PrimaryActionCase {
  expected: Partial<EntryHeaderPrimaryActions>
  name: string
  state: Partial<EntryHeaderPrimaryActionState>
}

const noPrimaryActions: EntryHeaderPrimaryActions = {
  createDraft: false,
  dirty: undefined,
  publishDraft: false,
  saveTranslation: false
}

const primaryCases: Array<PrimaryActionCase> = [
  {
    name: 'creates a draft from a revision when drafts are available',
    state: {isRevision: true},
    expected: {createDraft: true}
  },
  {
    name: 'does not fall through to publish from a revision',
    state: {activeStatus: 'draft', canSaveDraft: false, isRevision: true},
    expected: {}
  },
  {
    name: 'saves an available translation',
    state: {untranslated: true},
    expected: {saveTranslation: true}
  },
  {
    name: 'does not save a translation before its parent',
    state: {parentNeedsTranslation: true, untranslated: true},
    expected: {}
  },
  {
    name: 'offers every permitted dirty-entry action in order',
    state: {isDirty: true},
    expected: {dirty: {publish: true, saveDraft: true}}
  },
  {
    name: 'only discards when publish and draft access are unavailable',
    state: {
      access: {publish: false, update: false},
      canSaveDraft: false,
      isDirty: true
    },
    expected: {dirty: {publish: false, saveDraft: false}}
  },
  {
    name: 'publishes a clean draft whose parents can be published',
    state: {activeStatus: 'draft'},
    expected: {publishDraft: true}
  },
  {
    name: 'does not publish a draft with unpublishable parents',
    state: {activeStatus: 'draft', canPublishParents: false},
    expected: {}
  }
]

describe('entryHeaderPrimaryActions', () => {
  for (const actionCase of primaryCases) {
    test(actionCase.name, () => {
      expect(
        entryHeaderPrimaryActions({...primaryBase, ...actionCase.state})
      ).toEqual({...noPrimaryActions, ...actionCase.expected})
    })
  }
})

describe('entryDirtyActions', () => {
  test('allows publish and draft when both are available', () => {
    expect(entryDirtyActions(true, true)).toEqual({
      publish: true,
      saveDraft: true
    })
  })

  test('disables draft when drafts are unavailable', () => {
    expect(entryDirtyActions(true, false)).toEqual({
      publish: true,
      saveDraft: false
    })
  })

  test('disables publish and draft without access', () => {
    expect(entryDirtyActions(false, false)).toEqual({
      publish: false,
      saveDraft: false
    })
  })
})
