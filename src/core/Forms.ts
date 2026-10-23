import type {
  PrepareUploadRequest,
  PrepareUploadResult,
  SubmitRequest,
  SubmitResult
} from './Connection.js'

/** A notification mail of a form, for the mailer of the site */
export interface FormMail {
  to: Array<string>
  /** The address of the visitor, when the mail sets an input for it */
  replyTo?: string
  subject: string
  text: string
}

/** Sends a mail, eg. `mail => resend.emails.send({from, ...mail})` */
export type FormMailer = (mail: FormMail) => unknown | Promise<unknown>

export interface FormsOptions {
  /** Sends the notification mails of forms, see the Notifications tab */
  mailer?: FormMailer
}

export interface FormSubmitOptions {
  /** The locale of the form, when its root is translated */
  locale?: string | null
  /** The key of the form field, the first one of the entry by default */
  field?: string
  /**
   * Checks the visitor before the answers are sent, eg. a captcha. The
   * honeypot and the time it took to fill in the form are checked anyway.
   */
  verify?(): boolean | Promise<boolean>
}

/** A file a visitor is about to upload to a file input of a form */
export interface FormUploadFile {
  /** The key of the file input */
  input: string
  name: string
  size: number
  type: string
}

export interface Forms {
  /**
   * Sends the answers of a visitor to the form in an entry. Call it from a
   * server action, it uses the api key. Files posted with the answers are
   * uploaded first; with the `upload` of `<Form>` the browser uploads them.
   */
  submit(
    entryId: string,
    data: FormData,
    options?: FormSubmitOptions
  ): Promise<SubmitResult>
  /**
   * A ticket for the browser to upload a file to a file input, checked for
   * its size and type. Call it from the server action `<Form upload>` uses.
   */
  prepareUpload(
    entryId: string,
    file: FormUploadFile,
    options?: Omit<FormSubmitOptions, 'verify'>
  ): Promise<PrepareUploadResult>
}

export interface FormsClient {
  submit(request: SubmitRequest): Promise<SubmitResult>
  prepareFormUpload(request: PrepareUploadRequest): Promise<PrepareUploadResult>
}

export function formsOf(client: () => Promise<FormsClient>): Forms {
  async function prepareUpload(
    entryId: string,
    file: FormUploadFile,
    options: Omit<FormSubmitOptions, 'verify'> = {}
  ) {
    return (await client()).prepareFormUpload({
      entryId,
      locale: options.locale,
      field: options.field,
      ...file
    })
  }
  return {
    prepareUpload,
    async submit(entryId, data, options = {}) {
      if (options.verify && !(await options.verify()))
        return {ok: false, message: 'Your answers could not be verified'}
      const entries = Array<[string, string]>()
      const errors: Record<string, string> = {}
      for (const [key, value] of data) {
        if (typeof value === 'string') {
          entries.push([key, value])
          continue
        }
        // An input without a file sends an empty one
        if (value.size === 0) continue
        const ticket = await prepareUpload(
          entryId,
          {input: key, name: value.name, size: value.size, type: value.type},
          options
        )
        if (!ticket.ok) {
          errors[key] = ticket.message
          continue
        }
        const uploaded = await fetch(ticket.url, {
          method: ticket.method,
          headers: {'content-type': value.type || 'application/octet-stream'},
          body: value
        })
        if (uploaded.ok) entries.push([key, ticket.token])
        else errors[key] = await uploaded.text()
      }
      if (Object.keys(errors).length > 0) return {ok: false, errors}
      return (await client()).submit({
        entryId,
        locale: options.locale,
        field: options.field,
        data: entries
      })
    }
  }
}
