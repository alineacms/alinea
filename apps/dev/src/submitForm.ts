'use server'

import {cms} from '@/cms'
import type {FormUploadFile} from 'alinea/core/Forms'

/** Sends the answers of a visitor to the form in an entry */
export async function submitForm(entryId: string, data: FormData) {
  return cms.forms.submit(entryId, data)
}

/** A ticket for the browser of the visitor to upload a file with */
export async function prepareUpload(entryId: string, file: FormUploadFile) {
  return cms.forms.prepareUpload(entryId, file)
}
