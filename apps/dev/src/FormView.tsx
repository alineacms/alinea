'use client'

import type {FormDefinition} from 'alinea/form'
import {Form} from 'alinea/ui'
import {type FormEvent, useState} from 'react'
import styles from './FormView.module.css'

export interface FormViewProps {
  title: string
  definition: FormDefinition
}

const views = {
  form: <form className={styles.FormViewForm} />,
  section: <fieldset className={styles.FormViewSection} />,
  legend: <legend className={styles.FormViewLegend} />,
  row: <div className={styles.FormViewRow} />,
  label: <label className={styles.FormViewLabel} />,
  help: <p className={styles.FormViewHelp} />,
  error: <p className={styles.FormViewError} />,
  control: <input className={styles.FormViewControl} />,
  choice: <label className={styles.FormViewChoice} />,
  submit: <button className={styles.FormViewSubmit}>Send</button>
}

/** A form entry rendered with the default HTML of `<Form>` */
export function FormView({title, definition}: FormViewProps) {
  const [submitted, setSubmitted] = useState<Record<string, unknown>>()

  // Submitting is not built yet, show what the browser would send
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data: Record<string, unknown> = {}
    for (const [key, value] of new FormData(event.currentTarget)) {
      const entry = value instanceof File ? value.name : value
      const current = data[key]
      data[key] =
        current === undefined
          ? entry
          : Array.isArray(current)
            ? [...current, entry]
            : [current, entry]
    }
    setSubmitted(data)
  }

  return (
    <main className={styles.FormView}>
      <p className={styles.FormViewEyebrow}>Form</p>
      <h1 className={styles.FormViewTitle}>{title}</h1>
      <Form definition={definition} views={views} onSubmit={submit} />
      {submitted && (
        <pre className={styles.FormViewSubmitted}>
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </main>
  )
}
