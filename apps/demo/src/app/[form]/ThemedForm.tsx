/** biome-ignore-all lint/correctness/noUnusedVariables: used to prevent certain parameters from being passed to the DOM */
'use client'

import DaisyUIForm from '@rjsf/daisyui'
import {
  type ArrayFieldTitleProps,
  type DescriptionFieldProps,
  type FieldErrorProps,
  getSubmitButtonOptions,
  type IconButtonProps,
  type ObjectFieldTemplateProps,
  type SubmitButtonProps,
  type TitleFieldProps,
  titleId
} from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import type {Infer} from 'alinea'
import {cx} from 'class-variance-authority'
import {MoveDown, MoveUp, Trash2Icon, TriangleAlert} from 'lucide-react'
import {startTransition, useActionState, useState} from 'react'
import type {Form} from '@/Form.schema'
import {MyFieldWidget} from '../../project-specific-field/MyFieldWidget'
import {handleRjsfSubmit, type RjsfFormState} from './handleRjsfSubmit.action'

function TitleFieldTemplate(props: TitleFieldProps) {
  const {id, required, title} = props

  console.log(props)
  return (
    <header id={id} className="text-2xl bold underline mb-2">
      {title}
      {required && <mark>*</mark>}
    </header>
  )
}

function ArrayFieldTitleTemplate(
  props: ArrayFieldTitleProps & {fieldPathId: any}
) {
  const {title, fieldPathId} = props
  const id = titleId(fieldPathId)
  return (
    <h2 id={id} className="text-xl bold underline mb-2">
      {title}
    </h2>
  )
}

function AddButton(props: IconButtonProps) {
  const {icon, iconType, uiSchema, ...btnProps} = props
  return (
    <button {...btnProps} className="btn">
      +{icon}
    </button>
  )
}

function MoveUpButton(props: IconButtonProps) {
  const {icon, iconType, uiSchema, ...btnProps} = props
  return (
    <button {...btnProps} className={cx('btn btn-sm', btnProps.className)}>
      <MoveUp className="h-3 w-3 mx-1" />
    </button>
  )
}

function MoveDownButton(props: IconButtonProps) {
  const {icon, iconType, uiSchema, ...btnProps} = props
  return (
    <button {...btnProps} className={cx('btn btn-sm', btnProps.className)}>
      <MoveDown className="h-3 w-3 mx-1" />
    </button>
  )
}

function RemoveButton(props: IconButtonProps) {
  const {icon, iconType, uiSchema, ...btnProps} = props
  return (
    <button {...btnProps} className={cx('btn btn-sm', btnProps.className)}>
      <Trash2Icon className="h-3 w-3 mx-1" />
    </button>
  )
}

function SubmitButton(props: SubmitButtonProps) {
  const {uiSchema} = props
  const {norender} = getSubmitButtonOptions(uiSchema)
  if (norender) {
    return null
  }
  return (
    <button type="submit" className="btn btn-primary">
      Submit
    </button>
  )
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <div>
      {props.title && <div className="underline mb-2">{props.title}</div>}
      {props.description}
      {props.properties.map(element => (
        <div className="property-wrapper" key={element.name}>
          {element.content}
        </div>
      ))}
    </div>
  )
}

function FieldErrorTemplate(props: FieldErrorProps) {
  const {errors} = props

  if (!errors) return null

  let errorString = ''

  if (typeof errors === 'string') {
    errorString = errors
  } else if (Array.isArray(errors)) {
    errorString = errors.join(', ')
  } else {
    errorString = `${errors}`
  }
  return (
    <div role="alert" className="alert alert-error mt-2 mb-12 alert-soft">
      <TriangleAlert className="h-6 w-6 shrink-0 stroke-current" />
      <span>{errorString}</span>
    </div>
  )
}

export const ThemedForm: React.FC<{
  page: Infer.Entry<typeof Form>
}> = ({page}) => {
  const [theme, setTheme] = useState('light')
  const {schema, ui} = page.form
  const [state, dispatch, isPending] = useActionState<RjsfFormState, any>(
    handleRjsfSubmit,
    {
      key: 'initial',
      formId: page._id
    }
  )
  const onSubmit = (formData: any) => {
    console.log('Form submitted', formData)
    startTransition(() => {
      dispatch(formData)
    })
  }

  if (state.key === 'submitted') {
    console.log(state.submissions)
    return (
      <div>
        Thank you for your submission!
        {state.submissions?.length &&
          state.submissions.map((submission, index) => (
            <pre key={index} className="mt-4 p-4 bg-gray-100 rounded">
              {submission.id}: <br />
              {submission.data}
            </pre>
          ))}
      </div>
    )
  }

  return (
    <div data-theme={theme}>
      <select value={theme} onChange={e => setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="cupcake">Cupcake</option>
        <option value="cyberpunk">Cyberpunk</option>
        <option value="synthwave">Synthwave</option>
        {/* Add more themes as needed */}
      </select>
      <DaisyUIForm
        formData={state.key === 'error' ? state.formData : undefined}
        validator={validator as any}
        extraErrors={state.key === 'error' ? state.errors : undefined}
        onSubmit={({formData}, event) => {
          onSubmit(formData)
          event.preventDefault()
        }}
        schema={schema}
        uiSchema={ui!}
        widgets={{
          'my-custom-widget': MyFieldWidget
        }}
        templates={{
          ArrayFieldTitleTemplate,
          TitleFieldTemplate,
          ObjectFieldTemplate,
          FieldErrorTemplate,
          ButtonTemplates: {
            AddButton,
            MoveUpButton,
            MoveDownButton,
            RemoveButton,
            SubmitButton
          } as any
        }}
        showErrorList="bottom"
      >
        <button
          type="submit"
          className={cx('btn btn-primary')}
          disabled={isPending}
        >
          Submit
          {isPending && (
            <span className="loading loading-spinner loading-sm"></span>
          )}
        </button>
      </DaisyUIForm>
    </div>
  )
}
