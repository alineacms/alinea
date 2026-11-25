import type {FormMessages} from './FormMessages.js'

function items(count: number): string {
  return `${count} ${count === 1 ? 'élément' : 'éléments'}`
}

export const fr: FormMessages = {
  required: 'Remplissez ce champ',
  requiredChoice: 'Choisissez une option',
  requiredCheck: 'Cochez cette case pour continuer',
  requiredFile: 'Ajoutez un fichier',
  invalidEmail: 'Utilisez une adresse e-mail valide',
  invalidPhone: 'Utilisez un numéro de téléphone valide',
  invalidDate: 'Utilisez une date valide',
  unknownOption: 'Choisissez une option de la liste',
  tooLong: ({max}) => `Utilisez au plus ${max} caractères`,
  tooLow: ({min}) => `Utilisez ${min} ou plus`,
  tooHigh: ({max}) => `Utilisez ${max} ou moins`,
  tooEarly: ({min}) => `Choisissez le ${min} ou plus tard`,
  tooLate: ({max}) => `Choisissez le ${max} ou plus tôt`,
  oneFile: 'Ajoutez un seul fichier',
  fileTooLarge: ({max}) => `Choisissez un fichier de ${max} Mo au plus`,
  fileType: ({accept}) => `Choisissez un fichier de type ${accept}`,
  fileMismatch: ({name}) =>
    `Le contenu de ${name} ne correspond pas à son type de fichier`,
  tooFewItems: ({min}) => `Ajoutez au moins ${items(min)}`,
  tooManyItems: ({max}) => `Ajoutez au plus ${items(max)}`,
  alreadySent: 'Cette réponse a déjà été envoyée',
  closed: "Ce formulaire n'accepte plus de réponses",
  busy: "Ce formulaire n'accepte pas de réponses pour le moment, réessayez plus tard",
  tooOften: 'Vous avez envoyé ce formulaire trop souvent, réessayez plus tard',
  uploadAgain: 'Envoyez à nouveau le fichier',
  notVerified: "Vos réponses n'ont pas pu être vérifiées",
  uploadFailed: "Le fichier n'a pas pu être envoyé",
  checked: 'Oui',
  viewSubmission: 'Voir la réponse'
}
