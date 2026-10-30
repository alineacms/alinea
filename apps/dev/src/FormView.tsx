'use client'

import type {
  FormDefinition,
  FormResult,
  FormUploadFile,
  PrepareUploadResult
} from 'alinea/form'
import {Form} from 'alinea/ui'
import styles from './FormView.module.css'

export interface FormViewProps {
  title: string
  definition: FormDefinition
  action: (data: FormData) => Promise<FormResult>
  upload: (file: FormUploadFile) => Promise<PrepareUploadResult>
}

const views = {
  form: <form className={styles.FormViewForm} />,
  section: <fieldset className={styles.FormViewSection} />,
  legend: <legend className={styles.FormViewLegend} />,
  item: <div className={styles.FormViewItem} />,
  add: <button className={styles.FormViewAdd} />,
  remove: <button className={styles.FormViewRemove} />,
  row: <div className={styles.FormViewRow} />,
  label: <label className={styles.FormViewLabel} />,
  help: <p className={styles.FormViewHelp} />,
  error: <p className={styles.FormViewError} />,
  control: <input className={styles.FormViewControl} />,
  choice: <label className={styles.FormViewChoice} />,
  submit: <button className={styles.FormViewSubmit}>Send</button>,
  confirmation: <p className={styles.FormViewConfirmation} />
}

/** A form entry rendered with the default HTML of `<Form>` */
export function FormView({title, definition, action, upload}: FormViewProps) {
  return (
    <main className={styles.FormView}>
      <p className={styles.FormViewEyebrow}>Form</p>
      <h1 className={styles.FormViewTitle}>{title}</h1>
      <Form
        definition={definition}
        views={views}
        action={action}
        upload={upload}
      />
    </main>
  )
}
