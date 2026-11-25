import {
  IcOutlineViewList,
  IcRoundArrowDropDownCircle,
  IcRoundCheckBox,
  IcRoundChecklist,
  IcRoundDateRange,
  IcRoundEmail,
  IcRoundNotes,
  IcRoundNumbers,
  IcRoundPhone,
  IcRoundRadioButtonChecked,
  IcRoundShortText,
  IcRoundSubject,
  IcRoundUploadFile,
  IcRoundVisibilityOff
} from '#/dashboard/icons.js'
import {check as checkField} from '#/field/check.js'
import {date as dateField} from '#/field/date.js'
import {number as numberField} from '#/field/number.js'
import {richText} from '#/field/richtext.js'
import {text as textField} from '#/field/text.js'
import {choices, options} from './FormChoices.js'
import type {FormFileRef} from '#/core/Connection.js'
import {isAccepted} from './FormFileTypes.js'
import type {FormMessage} from './FormMessages.js'
import {content, input} from './FormInput.js'

const email_ = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phone = /^\+?[0-9 ()./-]{6,}$/

function tooLong(value: string, max: number | null): FormMessage | undefined {
  if (max && value.length > max) return {code: 'tooLong', max}
}

function inRange(
  value: number,
  min: number | null,
  max: number | null
): FormMessage | undefined {
  if (min !== null && value < min) return {code: 'tooLow', min}
  if (max !== null && value > max) return {code: 'tooHigh', max}
}

function unknownChoice(
  values: Array<string>,
  options: unknown
): FormMessage | undefined {
  const allowed = new Set(choices(options).map(choice => choice.value))
  if (values.some(value => !allowed.has(value))) return {code: 'unknownOption'}
}

export const text = input('Text', {
  icon: IcRoundShortText,
  strings: ['placeholder', 'initialValue'],
  settings: {
    placeholder: textField('Placeholder'),
    maxLength: numberField('Maximum length', {minValue: 1}),
    initialValue: textField('Initial value')
  },
  attributes: settings => ({
    type: 'text',
    placeholder: settings.placeholder,
    maxLength: settings.maxLength ?? undefined
  }),
  validate: (value, settings) => tooLong(value, settings.maxLength)
})

export const email = input('Email', {
  icon: IcRoundEmail,
  strings: ['placeholder'],
  settings: {
    placeholder: textField('Placeholder')
  },
  attributes: settings => ({
    type: 'email',
    autoComplete: 'email',
    placeholder: settings.placeholder
  }),
  validate: value => (email_.test(value) ? undefined : {code: 'invalidEmail'})
})

export const tel = input('Phone', {
  icon: IcRoundPhone,
  strings: ['placeholder'],
  settings: {
    placeholder: textField('Placeholder')
  },
  attributes: settings => ({
    type: 'tel',
    autoComplete: 'tel',
    placeholder: settings.placeholder
  }),
  validate: value => (phone.test(value) ? undefined : {code: 'invalidPhone'})
})

export const number = input('Number', {
  kind: 'number',
  icon: IcRoundNumbers,
  settings: {
    min: numberField('Minimum', {width: 0.5}),
    max: numberField('Maximum', {width: 0.5}),
    step: numberField('Step', {minValue: 0}),
    initialValue: numberField('Initial value')
  },
  parse: ([raw]) => {
    if (typeof raw !== 'string' || raw === '') return undefined
    const value = Number(raw)
    return Number.isNaN(value) ? undefined : value
  },
  attributes: settings => ({
    type: 'number',
    min: settings.min ?? undefined,
    max: settings.max ?? undefined,
    step: settings.step ?? undefined
  }),
  validate: (value, settings) => inRange(value, settings.min, settings.max)
})

export const textarea = input('Textarea', {
  icon: IcRoundNotes,
  control: 'textarea',
  strings: ['placeholder', 'initialValue'],
  settings: {
    placeholder: textField('Placeholder'),
    maxLength: numberField('Maximum length', {minValue: 1}),
    initialValue: textField('Initial value', {multiline: true})
  },
  attributes: settings => ({
    placeholder: settings.placeholder,
    maxLength: settings.maxLength ?? undefined
  }),
  validate: (value, settings) => tooLong(value, settings.maxLength)
})

export const date = input('Date', {
  kind: 'date',
  icon: IcRoundDateRange,
  settings: {
    min: dateField('Earliest date', {width: 0.5}),
    max: dateField('Latest date', {width: 0.5})
  },
  attributes: settings => ({
    type: 'date',
    min: settings.min,
    max: settings.max
  }),
  validate: (value, settings) => {
    const {min, max} = settings
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return {code: 'invalidDate'}
    if (min && value < min) return {code: 'tooEarly', min}
    if (max && value > max) return {code: 'tooLate', max}
  }
})

export const file = input('File', {
  kind: 'file',
  icon: IcRoundUploadFile,
  settings: {
    accept: textField('Accepted files', {
      help: 'File extensions or types, eg. .png, .jpg, .pdf'
    }),
    maxSize: numberField('Maximum size', {
      help: 'In megabytes',
      minValue: 0
    }),
    multiple: checkField('Multiple', {description: 'Allow several files'})
  },
  // The server turns uploaded files into references, see `resolveFiles`
  parse: raw => {
    const files = raw.flatMap(value => {
      if (typeof value !== 'string') return []
      try {
        const file = JSON.parse(value) as FormFileRef
        return typeof file.id === 'string' ? [file] : []
      } catch {
        return []
      }
    })
    return files.length > 0 ? files : undefined
  },
  attributes: settings => ({
    type: 'file',
    accept: settings.accept,
    multiple: settings.multiple
  }),
  validate: (files: Array<FormFileRef>, settings) => {
    const {multiple, maxSize, accept = ''} = settings
    if (!multiple && files.length > 1) return {code: 'oneFile'}
    for (const file of files) {
      if (maxSize && file.size > maxSize * 1024 * 1024)
        return {code: 'fileTooLarge', max: maxSize}
      if (!isAccepted(accept, file)) return {code: 'fileType', accept}
    }
  }
})

export const radio = input('Radio', {
  icon: IcRoundRadioButtonChecked,
  control: 'radio',
  fields: {options: options()},
  validate: (value, settings) => unknownChoice([value], settings.options)
})

export const checkboxes = input('Checkboxes', {
  icon: IcRoundChecklist,
  control: 'checkboxes',
  fields: {options: options()},
  parse: raw => {
    const values = raw.filter(value => typeof value === 'string')
    return values.length > 0 ? values : undefined
  },
  validate: (value: Array<string>, settings) =>
    unknownChoice(value, settings.options)
})

export const select = input('Select', {
  icon: IcRoundArrowDropDownCircle,
  control: 'select',
  fields: {options: options()},
  strings: ['placeholder'],
  settings: {placeholder: textField('Placeholder')},
  validate: (value, settings) => unknownChoice([value], settings.options)
})

export const check = input('Check', {
  icon: IcRoundCheckBox,
  control: 'check',
  fields: {
    text: richText('Text next to the checkbox', {
      help: 'Shown to visitors, can include links, eg. to your terms. Without it they see the label.'
    })
  },
  strings: ['text'],
  settings: {
    initialValue: checkField('Checked', {description: 'Checked by default'})
  },
  parse: ([raw]) => (raw ? true : undefined)
})

/**
 * Sent with the answers without being shown, eg. the campaign a visitor came
 * from. Its value is set in the form, taken from a parameter of the address
 * of the page or passed to `<Form values>`.
 */
export const hidden = input('Hidden', {
  icon: IcRoundVisibilityOff,
  settings: {
    initialValue: textField('Value', {help: 'Sent unless one is found below'}),
    param: textField('From the address', {
      help: 'A parameter of the address of the page, eg. utm_campaign'
    })
  },
  attributes: settings => ({
    type: 'hidden',
    'data-param': settings.param || undefined
  })
})

export const section = input('Section', {
  icon: IcOutlineViewList,
  control: 'section'
})

/**
 * Text between the inputs, eg. how the answers are kept. It is shown in the
 * form and has no answer.
 */
export const textContent = content('Text', {
  icon: IcRoundSubject,
  fields: {body: richText('Text')},
  strings: ['body']
})

/** The inputs alinea provides, add your own next to them */
export const defaults = {
  text,
  email,
  tel,
  number,
  textarea,
  date,
  file,
  radio,
  checkboxes,
  select,
  check,
  hidden,
  section,
  content: textContent
}
