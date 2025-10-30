'use client'

import RJSFForm from '@rjsf/shadcn'
import validator from '@rjsf/validator-ajv8'
import type {Infer} from 'alinea'
import {useActionState, useState} from 'react'
import {Button} from '@/components/ui/button'
import type {Form} from '@/Form.schema'
import {handleRjsfSubmit} from './handleRjsfSubmit.action'

export const ThemedForm: React.FC<{
  page: Infer.Entry<typeof Form>
}> = ({page}) => {
  const {schema, ui} = page.form
  const [state, dispatch, isPending] = useActionState(handleRjsfSubmit, {})

  return (
    <form action={dispatch}>
      <RJSFForm
        validator={validator}
        schema={schema}
        uiSchema={ui}
        tagName="div"
      >
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending ? 'Saving...' : 'Submit'}
        </Button>
      </RJSFForm>
    </form>
  )
}
