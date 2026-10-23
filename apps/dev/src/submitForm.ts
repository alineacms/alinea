'use server'

import {cms} from '@/cms'

/** Sends the answers of a visitor to the form in an entry */
export async function submitForm(entryId: string, data: FormData) {
  return cms.forms.submit(entryId, data)
}
