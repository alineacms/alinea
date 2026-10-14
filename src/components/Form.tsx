import styler from '@alinea/styler'
import {type FormEvent, type ReactNode, useMemo, useState} from 'react'
import {Form as FormPrimitive} from 'react-aria-components'
import css from './Form.module.css'
import {FormScope} from './internal/FormScope.js'
import type {
  AriaProps,
  DataProps,
  StyleProps,
  ValidationErrors
} from './types.js'

const styles = styler(css)

export type FormSubmitResult = ValidationErrors | undefined | void

export interface FormProps extends StyleProps, AriaProps, DataProps {
  /**
   * Errors keyed by field name, eg. from the server. A field shows its
   * error until it is edited.
   */
  validationErrors?: ValidationErrors
  /**
   * Called with the form data instead of submitting the form natively.
   * Errors it returns are shown on the fields, next to `validationErrors`.
   */
  onSubmit?: (data: FormData) => FormSubmitResult | Promise<FormSubmitResult>
  children: ReactNode
}

/**
 * A form whose fields show validation errors: native constraints such as
 * `required` once the form is submitted, and `validationErrors` or the
 * errors returned by `onSubmit` by field name. An `error` set on a field
 * itself takes precedence.
 */
export function Form({
  validationErrors,
  onSubmit,
  className,
  children,
  ...props
}: FormProps) {
  const [returned, setReturned] = useState<ValidationErrors>()
  const [pending, setPending] = useState(false)
  const errors = useMemo(
    () => (returned ? {...validationErrors, ...returned} : validationErrors),
    [validationErrors, returned]
  )
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!onSubmit) return
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    try {
      setReturned((await onSubmit(data)) || undefined)
    } finally {
      setPending(false)
    }
  }
  return (
    <FormScope.Provider value>
      <FormPrimitive
        data-slot="form"
        {...props}
        data-pending={pending || undefined}
        validationErrors={errors}
        onSubmit={submit}
        className={styles.Form(styler.merge({className}))}
      >
        {children}
      </FormPrimitive>
    </FormScope.Provider>
  )
}
