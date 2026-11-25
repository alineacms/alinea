import type {FormMessages} from './FormMessages.js'

function items(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

export const nl: FormMessages = {
  required: 'Vul dit veld in',
  requiredChoice: 'Kies een optie',
  requiredCheck: 'Vink dit aan om verder te gaan',
  requiredFile: 'Voeg een bestand toe',
  invalidEmail: 'Gebruik een geldig e-mailadres',
  invalidPhone: 'Gebruik een geldig telefoonnummer',
  invalidDate: 'Gebruik een geldige datum',
  unknownOption: 'Kies een optie uit de lijst',
  tooLong: ({max}) => `Gebruik hoogstens ${max} tekens`,
  tooLow: ({min}) => `Gebruik ${min} of meer`,
  tooHigh: ({max}) => `Gebruik ${max} of minder`,
  tooEarly: ({min}) => `Kies ${min} of later`,
  tooLate: ({max}) => `Kies ${max} of vroeger`,
  oneFile: 'Voeg één bestand toe',
  fileTooLarge: ({max}) => `Kies een bestand van hoogstens ${max} MB`,
  fileType: ({accept}) => `Kies een bestand van het type ${accept}`,
  fileMismatch: ({name}) =>
    `${name} is niet het soort bestand dat zijn naam zegt`,
  tooFewItems: ({min}) => `Voeg minstens ${items(min)} toe`,
  tooManyItems: ({max}) => `Voeg hoogstens ${items(max)} toe`,
  alreadySent: 'Dit antwoord werd al verzonden',
  closed: 'Dit formulier neemt geen antwoorden meer aan',
  busy: 'Dit formulier neemt nu geen antwoorden aan, probeer het later opnieuw',
  tooOften: 'Je hebt dit formulier vaak verzonden, probeer het later opnieuw',
  uploadAgain: 'Upload het bestand opnieuw',
  notVerified: 'Je antwoorden konden niet worden gecontroleerd',
  uploadFailed: 'Het bestand kon niet worden geüpload'
}
