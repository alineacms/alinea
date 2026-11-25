import {de} from './FormMessages.de.js'
import {fr} from './FormMessages.fr.js'
import {nl} from './FormMessages.nl.js'

/** What each message visitors see takes, by its code */
export interface FormMessageParams {
  required: object
  requiredChoice: object
  requiredCheck: object
  requiredFile: object
  invalidEmail: object
  invalidPhone: object
  invalidDate: object
  unknownOption: object
  tooLong: {max: number}
  tooLow: {min: number}
  tooHigh: {max: number}
  tooEarly: {min: string}
  tooLate: {max: string}
  oneFile: object
  /** A file input's maximum size, in megabytes */
  fileTooLarge: {max: number}
  fileType: {accept: string}
  /** A file whose first bytes are not of the type its name says */
  fileMismatch: {name: string}
  tooFewItems: {min: number}
  tooManyItems: {max: number}
  alreadySent: object
  closed: object
  busy: object
  tooOften: object
  uploadAgain: object
  notVerified: object
  uploadFailed: object
}

export type FormMessageCode = keyof FormMessageParams

/** A message for visitors by its code, eg. `{code: 'tooLong', max: 200}` */
export type FormMessage = {
  [C in FormMessageCode]: {code: C} & FormMessageParams[C]
}[FormMessageCode]

/** The text of each message, as is or made from what it takes */
export type FormMessages = {
  [C in FormMessageCode]: string | ((params: FormMessageParams[C]) => string)
}

/**
 * Texts by locale that replace those alinea has, or add a language, eg.
 * `{nl: {tooLong: ({max}) => ...}}`
 */
export type FormLocaleMessages = Record<string, Partial<FormMessages>>

function items(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

export const en: FormMessages = {
  required: 'Fill in this field',
  requiredChoice: 'Choose an option',
  requiredCheck: 'Check this to continue',
  requiredFile: 'Add a file',
  invalidEmail: 'Use a valid email address',
  invalidPhone: 'Use a valid phone number',
  invalidDate: 'Use a valid date',
  unknownOption: 'Choose a listed option',
  tooLong: ({max}) => `Use at most ${max} characters`,
  tooLow: ({min}) => `Use ${min} or more`,
  tooHigh: ({max}) => `Use ${max} or less`,
  tooEarly: ({min}) => `Choose ${min} or later`,
  tooLate: ({max}) => `Choose ${max} or earlier`,
  oneFile: 'Add one file',
  fileTooLarge: ({max}) => `Choose a file of at most ${max} MB`,
  fileType: ({accept}) => `Choose a file of type ${accept}`,
  fileMismatch: ({name}) => `${name} is not the kind of file its name says`,
  tooFewItems: ({min}) => `Add at least ${items(min)}`,
  tooManyItems: ({max}) => `Add at most ${items(max)}`,
  alreadySent: 'This answer was already sent',
  closed: 'This form no longer takes answers',
  busy: 'This form takes no more answers right now, try again later',
  tooOften: 'You sent this form often, try again later',
  uploadAgain: 'Upload the file again',
  notVerified: 'Your answers could not be verified',
  uploadFailed: 'The file could not be uploaded'
}

const packs: FormLocaleMessages = {en, nl, fr, de}

/**
 * Turns messages into text for a locale: the texts of the locale, then of
 * its language (nl for nl-BE), then English. Texts are shown as is.
 */
export function translate(
  locale?: string | null,
  messages: FormLocaleMessages = {}
): (message: string | FormMessage) => string {
  const tag = locale?.toLowerCase()
  const tags = [tag, tag?.split(/[-_]/)[0], 'en']
  const find = (source: FormLocaleMessages, tag: string | undefined) =>
    Object.entries(source).find(([key]) => key.toLowerCase() === tag)?.[1]
  const chain = tags.flatMap(tag => [find(messages, tag), find(packs, tag)])
  return message => {
    if (typeof message === 'string') return message
    const text = chain.find(pack => pack?.[message.code] !== undefined)![
      message.code
    ]! as string | ((params: object) => string)
    return typeof text === 'string' ? text : text(message)
  }
}

/** Errors of inputs by their name, or the message of the whole form */
export type FormProblems = Record<string, string | FormMessage>

/** Errors as text, with the codes of those that have one */
export function translateErrors(
  problems: FormProblems,
  text: (message: string | FormMessage) => string
): {errors: Record<string, string>; codes: Record<string, FormMessageCode>} {
  const errors: Record<string, string> = {}
  const codes: Record<string, FormMessageCode> = {}
  for (const [name, problem] of Object.entries(problems)) {
    errors[name] = text(problem)
    if (typeof problem !== 'string') codes[name] = problem.code
  }
  return {errors, codes}
}
