import type {DatabaseDeclaration} from '#/backend/api/CreateBackend.js'
import type {
  PrepareUploadRequest,
  PrepareUploadResult,
  Submission,
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

/** A submission that was just stored, for `forms.onSubmit` */
export interface FormSubmitEvent {
  submission: Submission
  /** The title of the form entry */
  title: string
}

/**
 * Keeps the files visitors upload outside the database, eg. in a private
 * bucket made with `formFiles.s3` from `alinea/backend`
 */
export interface FormFileStorage {
  write(key: string, content: Uint8Array, type: string): Promise<void>
  read(key: string): Promise<Uint8Array | undefined>
  remove(keys: Array<string>): Promise<void>
}

/** How often a visitor may send to one form, per hour */
export interface FormLimits {
  /** Submissions one form takes per hour, 500 by default */
  submissions?: number
  /** Files one form takes per hour, 1000 by default */
  uploads?: number
  /**
   * What one visitor may send to a form per hour, when the site passes a
   * `visitor` to `cms.forms.submit`: 20 submissions and 50 files by default
   */
  perVisitor?: {submissions?: number; uploads?: number}
}

export interface FormsOptions {
  /** Sends the notification mails of forms, see the Notifications tab */
  mailer?: FormMailer
  /**
   * Where submissions are stored when the backend has no database of its
   * own, eg. when content is hosted on alinea.cloud
   */
  database?: DatabaseDeclaration
  /**
   * Keeps uploaded files outside the database. Without it they are stored
   * in the database, which suits small files only.
   */
  files?: FormFileStorage
  /**
   * Called once a submission is stored, eg. to send it on to a CRM. It is
   * awaited, a failure is logged and the visitor is not told.
   */
  onSubmit?(event: FormSubmitEvent): unknown | Promise<unknown>
  /**
   * Limits how often one visitor sends to a form, by the `visitor` the site
   * passes to `cms.forms.submit`. Set to false to not limit.
   */
  limits?: FormLimits | false
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
  /**
   * Who sends it, to limit how often one visitor sends, see
   * `forms.limits.perVisitor`: anything that identifies them on your site,
   * eg. the id of their session. The handler only keeps a hash of it.
   */
  visitor?: string
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
      visitor: options.visitor,
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
        visitor: options.visitor,
        data: entries
      })
    }
  }
}
