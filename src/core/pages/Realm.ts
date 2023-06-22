import {EntryPhase} from '../EntryRow.js'

export enum Realm {
  // Query only published entries
  Published = EntryPhase.Published,
  // Query only drafts
  Draft = EntryPhase.Draft,
  // Query only archived entries
  Archived = EntryPhase.Archived,
  // Prefer drafts, then published, then archived
  PreferDraft = 'active',
  // Prefer published, then archived, then drafts
  PreferPublished = 'main',
  // Query all phases
  All = 'all'
}
