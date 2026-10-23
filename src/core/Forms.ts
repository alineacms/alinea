import type {SubmitRequest, SubmitResult} from './Connection.js'

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

export interface Forms {
  /**
   * Sends the answers of a visitor to the form in an entry. Call it from a
   * server action, it uses the api key.
   */
  submit(
    entryId: string,
    data: FormData,
    options?: FormSubmitOptions
  ): Promise<SubmitResult>
}

export interface FormsClient {
  submit(request: SubmitRequest): Promise<SubmitResult>
}

export function formsOf(client: () => Promise<FormsClient>): Forms {
  return {
    async submit(entryId, data, options = {}) {
      if (options.verify && !(await options.verify()))
        return {ok: false, message: 'Your answers could not be verified'}
      // Files are not sent along yet, they are uploaded on their own
      const entries = Array.from(data).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
      return (await client()).submit({
        entryId,
        locale: options.locale,
        field: options.field,
        data: entries
      })
    }
  }
}
