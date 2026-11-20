'use server'

import {cms} from '@/cms'
import type {FormUploadFile} from 'alinea/form'
import {headers} from 'next/headers'

/** Who sends the form, to limit how often one visitor sends */
async function visitor() {
  // Use a header your host sets, a visitor can send x-forwarded-for
  // themselves when nothing in front of your site replaces it
  const list = await headers()
  const forwarded = list.get('x-forwarded-for')?.split(',')[0]
  return list.get('x-real-ip') ?? forwarded
}

/** Sends the answers of a visitor to the form in an entry */
export async function submitForm(entryId: string, data: FormData) {
  return cms.forms.submit(entryId, data, {visitor: await visitor()})
}

/** A ticket for the browser of the visitor to upload a file with */
export async function prepareUpload(entryId: string, file: FormUploadFile) {
  return cms.forms.prepareUpload(entryId, file, {visitor: await visitor()})
}
