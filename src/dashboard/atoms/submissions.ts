import type {Submission} from '#/core/Connection.js'
import {atom} from 'jotai'
import {clientAtom} from './core.js'
import {dispense} from './utils.js'

/** Bumped after a change, so the submissions of the entry load again */
export const submissionsVersion = dispense((entryId: string) => atom(0))

/** A submission of the form of an entry by its id, null once it is gone */
export const submissionAtom = dispense((entryId: string, id: string) =>
  atom(async (get): Promise<Submission | null> => {
    get(submissionsVersion(entryId))
    const {submissions} = await get(clientAtom).submissions(entryId, {
      id,
      status: 'all',
      limit: 1
    })
    return submissions.find(submission => submission.id === id) ?? null
  })
)
