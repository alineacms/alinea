import type {DatabaseDeclaration} from '#/backend/api/CreateBackend.js'
import {type FormLocaleMessages, translate} from '#/field/form/FormMessages.js'
import {isRecord} from './util/Objects.js'
import type {
  FormStatus,
  FormStatusRequest,
  PrepareUploadRequest,
  PrepareUploadResult,
  Submission,
  SubmitRequest,
  SubmitResult
} from './Connection.js'

/** A notification mail of a form, for the mailer of the site */
export interface FormMail {
  to: Array<string>
  cc?: Array<string>
  /** The address of the visitor, when the mail sets an input for it */
  replyTo?: string
  subject: string
  /** The body as plain text */
  text: string
  /**
   * The body as an html fragment with inline styles, to put in a layout of
   * your own, eg. `html: layout(mail.content)`
   */
  content: string
  /** The body as a complete html mail, `content` in a plain layout */
  html: string
  /** The files of the submission, for mails set to attach them */
  attachments?: Array<FormMailAttachment>
}

/**
 * A file attached to a mail. Its content is base64, which Resend, Nodemailer
 * and SendGrid take as it is.
 */
export interface FormMailAttachment {
  filename: string
  /** The bytes of the file as base64 */
  content: string
  encoding: 'base64'
  contentType?: string
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
export interface FormRateLimit {
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
   * Limits how often a form and one visitor send, by the `visitor` the site
   * passes to `cms.forms.submit`. Set to false to not limit.
   */
  rateLimit?: FormRateLimit | false
  /**
   * Texts for the messages visitors see, by locale and code, which replace
   * those of alinea (en, nl, fr and de) or add a language, eg.
   * `{nl: {tooLong: ({max}) => \`Maximaal ${max} tekens\`}}`
   */
  messages?: FormLocaleMessages
}

export interface FormSubmitOptions {
  /** The locale of the form, when its root is translated */
  locale?: string | null
  /**
   * Checks the visitor before the answers are sent, eg. a captcha. The
   * honeypot and the time it took to fill in the form are checked anyway.
   */
  verify?(): boolean | Promise<boolean>
  /**
   * Who sends it, to limit how often one visitor sends, see
   * `forms.rateLimit.perVisitor`: anything that identifies them on your
   * site, eg. the id of their session. The handler only keeps a hash of it.
   */
  visitor?: string
  /**
   * Texts for the messages `submit` makes itself, before the answers reach
   * the handler, eg. when `verify` fails or a file could not be uploaded.
   * Pass the `forms.messages` of `createHandler`, which make the others.
   */
  messages?: FormLocaleMessages
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
    options?: Omit<FormSubmitOptions, 'verify' | 'messages'>
  ): Promise<PrepareUploadResult>
  /**
   * Whether a form still takes answers, eg. not once it took its most
   * submissions, with the message to show instead of it
   */
  status(
    entryId: string,
    options?: Pick<FormSubmitOptions, 'locale'>
  ): Promise<FormStatus>
}

export interface FormsClient {
  submit(request: SubmitRequest): Promise<SubmitResult>
  formStatus(request: FormStatusRequest): Promise<FormStatus>
  prepareFormUpload(request: PrepareUploadRequest): Promise<PrepareUploadResult>
}

export function formsOf(client: () => Promise<FormsClient>): Forms {
  async function prepareUpload(
    entryId: string,
    file: FormUploadFile,
    options: Omit<FormSubmitOptions, 'verify' | 'messages'> = {}
  ) {
    return (await client()).prepareFormUpload({
      entryId,
      locale: options.locale,
      visitor: options.visitor,
      ...file
    })
  }
  return {
    prepareUpload,
    async status(entryId, options = {}) {
      return (await client()).formStatus({entryId, locale: options.locale})
    },
    async submit(entryId, data, options = {}) {
      const text = translate(options.locale, options.messages)
      if (options.verify && !(await options.verify()))
        return {ok: false, message: text({code: 'notVerified'})}
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
        const error = await uploadFile(
          ticket,
          value,
          options.locale,
          options.messages
        )
        if (error) errors[key] = error
        else entries.push([key, ticket.token])
      }
      if (Object.keys(errors).length > 0) return {ok: false, errors}
      return (await client()).submit({
        entryId,
        locale: options.locale,
        visitor: options.visitor,
        data: entries
      })
    }
  }
}

/**
 * Uploads a file with its ticket, or tells what a visitor sees when that
 * failed: the reason the handler refused it, or that it could not be
 * uploaded. What went wrong beyond that is for the console.
 */
export async function uploadFile(
  ticket: {url: string; method: 'PUT'},
  file: Blob,
  locale?: string | null,
  messages?: FormLocaleMessages
): Promise<string | undefined> {
  const failed = (problem: string, ...details: Array<unknown>) => {
    console.error(`Alinea could not upload a file: ${problem}`, ...details)
    return translate(locale, messages)({code: 'uploadFailed'})
  }
  let response: Response
  try {
    response = await fetch(ticket.url, {
      method: ticket.method,
      headers: {'content-type': file.type || 'application/octet-stream'},
      body: file
    })
  } catch (cause) {
    // Browsers ask the handler first when it is on another origin than the
    // page, which a route without OPTIONS does not answer for it
    return failed(
      `${URL.parse(ticket.url)?.origin} could not be reached, export OPTIONS ` +
        'from the route of createHandler',
      cause
    )
  }
  if (response.ok) return undefined
  const text = await response.text()
  const refused = parseRefusal(text)
  if (refused) return refused
  // Routes made before forms had file inputs only export GET and POST
  if (response.status === 405)
    return failed('export PUT from the route of createHandler')
  if (response.status === 413)
    return failed(
      'the host refused a request this large, keep the maximum size of ' +
        'file inputs below its limit'
    )
  return failed(`the handler answered ${response.status}`, text)
}

/** The reason the handler refused a file, see `receiveUpload` */
function parseRefusal(text: string): string | undefined {
  try {
    const body: unknown = JSON.parse(text)
    if (isRecord(body) && typeof body.error === 'string') return body.error
  } catch {}
  return undefined
}
