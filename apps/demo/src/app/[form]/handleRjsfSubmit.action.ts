'use server'

import validator from '@rjsf/validator-ajv8'
import {cms} from '@/cms'
import {Form} from '@/Form.schema'
import {getDb} from '@/lib/db'

export type RjsfFormState =
  | {
      key: 'initial'
      formId: string
    }
  | {
      key: 'error'
      formId: string
      formData: any
      errors: any
    }
  | {
      key: 'submitted'
      formId: string
      submissions?: any[]
    }

export async function handleRjsfSubmit(
  state: RjsfFormState,
  formData: any
): Promise<RjsfFormState> {
  console.log('state', state)
  console.log('formData', formData)

  const page = await cms.first({type: Form, id: state.formId})
  if (!page) return state

  // Validate data

  const validationData = validator.validateFormData(
    formData,
    page.form.schema,
    undefined,
    undefined,
    page.form.ui
  )

  if (validationData.errors.length > 0) {
    console.error(state, formData, validationData.errors)
    return {
      key: 'error',
      formId: state.formId,
      formData,
      errors: validationData
    }
  }

  const db = getDb()
  try {
    await db
      .prepare(
        `INSERT INTO submissions (id, form_id, data) VALUES (@id, @form_id, @data)`
      )
      .run({
        id: crypto.randomUUID(),
        form_id: state.formId,
        data: JSON.stringify(formData)
      })
  } catch (error) {
    console.error(error)
    return {
      key: 'error',
      formId: state.formId,
      formData,
      errors: [
        {
          name: 'dbStorageFailed',
          property: 'general',
          message: 'Failed writing data to the database. Please try again.',
          stack: 'Failed writing data to the database. Please try again.'
        }
      ]
    }
  }

  try {
    const db = getDb()
    const submissions = await db
      .prepare(
        'SELECT * FROM submissions WHERE form_id = @form_id ORDER BY inserted_at DESC'
      )
      .all({form_id: state.formId})
    return {
      key: 'submitted',
      formId: state.formId,
      submissions
    }
  } catch (e) {}

  return {
    key: 'submitted',
    formId: state.formId
  }
}
