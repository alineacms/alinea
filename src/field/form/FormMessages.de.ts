import type {FormMessages} from './FormMessages.js'

function items(count: number): string {
  return `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`
}

export const de: FormMessages = {
  required: 'Füllen Sie dieses Feld aus',
  requiredChoice: 'Wählen Sie eine Option',
  requiredCheck: 'Kreuzen Sie dies an, um fortzufahren',
  requiredFile: 'Fügen Sie eine Datei hinzu',
  invalidEmail: 'Verwenden Sie eine gültige E-Mail-Adresse',
  invalidPhone: 'Verwenden Sie eine gültige Telefonnummer',
  invalidDate: 'Verwenden Sie ein gültiges Datum',
  unknownOption: 'Wählen Sie eine Option aus der Liste',
  tooLong: ({max}) => `Verwenden Sie höchstens ${max} Zeichen`,
  tooLow: ({min}) => `Verwenden Sie ${min} oder mehr`,
  tooHigh: ({max}) => `Verwenden Sie ${max} oder weniger`,
  tooEarly: ({min}) => `Wählen Sie ${min} oder später`,
  tooLate: ({max}) => `Wählen Sie ${max} oder früher`,
  oneFile: 'Fügen Sie nur eine Datei hinzu',
  fileTooLarge: ({max}) => `Wählen Sie eine Datei von höchstens ${max} MB`,
  fileType: ({accept}) => `Wählen Sie eine Datei vom Typ ${accept}`,
  fileMismatch: ({name}) =>
    `${name} ist nicht die Art Datei, die ihr Name angibt`,
  tooFewItems: ({min}) => `Fügen Sie mindestens ${items(min)} hinzu`,
  tooManyItems: ({max}) => `Fügen Sie höchstens ${items(max)} hinzu`,
  alreadySent: 'Diese Antwort wurde bereits gesendet',
  closed: 'Dieses Formular nimmt keine Antworten mehr an',
  busy: 'Dieses Formular nimmt gerade keine Antworten an, versuchen Sie es später erneut',
  tooOften:
    'Sie haben dieses Formular oft gesendet, versuchen Sie es später erneut',
  uploadAgain: 'Laden Sie die Datei erneut hoch',
  notVerified: 'Ihre Antworten konnten nicht überprüft werden',
  uploadFailed: 'Die Datei konnte nicht hochgeladen werden',
  checked: 'Ja',
  viewSubmission: 'Einsendung ansehen'
}
