import {describe, expect, test} from 'bun:test'
import {
  entryHeaderActionIds,
  entryHeaderPrimaryActionIds,
  type EntryHeaderActionId,
  type EntryHeaderActionState,
  type EntryHeaderPrimaryActionId,
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
  expected: Array<EntryHeaderActionId>
  name: string
  state: Partial<EntryHeaderActionState>
}

const cases: Array<ActionCase> = [
  {
    name: 'hides actions for a revision',
    state: {isRevision: true},
    expected: []
  },
  {
    name: 'hides actions while dirty',
    state: {isDirty: true},
    expected: []
  },
  {
    name: 'hides actions for an untranslated entry',
    state: {untranslated: true},
    expected: []
  },
  {
    name: 'only removes a regular draft',
    state: {activeStatus: 'draft'},
    expected: ['remove-draft']
  },
  {
    name: 'does not remove a draft without update access',
    state: {
      access: {...base.access, update: false},
      activeStatus: 'draft'
    },
    expected: []
  },
  {
    name: 'deletes an unpublished entry only below an unpublished parent',
    state: {
      activeStatus: 'draft',
      isParentUnpublished: true,
      isUnpublished: true
    },
    expected: ['delete']
  },
  {
    name: 'does not delete a seeded unpublished entry',
    state: {
      activeStatus: 'draft',
      canDelete: false,
      isParentUnpublished: true,
      isUnpublished: true
    },
    expected: []
  },
  {
    name: 'archives an unpublished entry below a published parent',
    state: {activeStatus: 'draft', isUnpublished: true},
    expected: ['archive']
  },
  {
    name: 'offers unpublish and archive for a published entry',
    state: {},
    expected: ['unpublish', 'archive']
  },
  {
    name: 'does not offer delete directly for a published entry',
    state: {access: {...base.access, archive: false, publish: false}},
    expected: []
  },
  {
    name: 'does not unpublish when drafts are disabled',
    state: {draftsEnabled: false},
    expected: ['archive']
  },
  {
    name: 'does not unpublish a media library',
    state: {isMediaLibrary: true},
    expected: ['archive']
  },
  {
    name: 'replaces or deletes a published media file',
    state: {isMediaFile: true},
    expected: ['replace', 'delete']
  },
  {
    name: 'does not archive a published media file',
    state: {
      access: {...base.access, delete: false, update: false},
      isMediaFile: true
    },
    expected: []
  },
  {
    name: 'does not archive a seeded published entry',
    state: {canDelete: false},
    expected: ['unpublish']
  },
  {
    name: 'publishes or deletes an archived entry',
    state: {activeStatus: 'archived'},
    expected: ['publish', 'delete']
  },
  {
    name: 'does not publish an archived entry with unpublishable parents',
    state: {activeStatus: 'archived', canPublishParents: false},
    expected: ['delete']
  }
]

describe('entryHeaderActionIds', () => {
  for (const actionCase of cases) {
    test(actionCase.name, () => {
      expect(entryHeaderActionIds({...base, ...actionCase.state})).toEqual(
        actionCase.expected
      )
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
  expected: Array<EntryHeaderPrimaryActionId>
  name: string
  state: Partial<EntryHeaderPrimaryActionState>
}

const primaryCases: Array<PrimaryActionCase> = [
  {
    name: 'creates a draft from a revision when drafts are available',
    state: {isRevision: true},
    expected: ['create-draft']
  },
  {
    name: 'does not fall through to publish from a revision',
    state: {activeStatus: 'draft', canSaveDraft: false, isRevision: true},
    expected: []
  },
  {
    name: 'saves an available translation',
    state: {untranslated: true},
    expected: ['save-translation']
  },
  {
    name: 'does not save a translation before its parent',
    state: {parentNeedsTranslation: true, untranslated: true},
    expected: []
  },
  {
    name: 'offers every permitted dirty-entry action in order',
    state: {isDirty: true},
    expected: ['discard-changes', 'publish-edits', 'save-draft']
  },
  {
    name: 'only discards when publish and draft access are unavailable',
    state: {
      access: {publish: false, update: false},
      canSaveDraft: false,
      isDirty: true
    },
    expected: ['discard-changes']
  },
  {
    name: 'publishes a clean draft whose parents can be published',
    state: {activeStatus: 'draft'},
    expected: ['publish-draft']
  },
  {
    name: 'does not publish a draft with unpublishable parents',
    state: {activeStatus: 'draft', canPublishParents: false},
    expected: []
  }
]

describe('entryHeaderPrimaryActionIds', () => {
  for (const actionCase of primaryCases) {
    test(actionCase.name, () => {
      expect(
        entryHeaderPrimaryActionIds({...primaryBase, ...actionCase.state})
      ).toEqual(actionCase.expected)
    })
  }
})
