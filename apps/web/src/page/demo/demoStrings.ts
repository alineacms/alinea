import type {DemoLocale} from '@/schema/demo/DemoUrl'

const strings = {
  en: {
    languages: 'Language',
    menu: 'Menu',
    from: 'From',
    price: 'Price',
    addToBasket: 'Add to basket',
    madeToOrder: 'Made to order',
    shipsIn: (weeks: number) => `Made to order, ships in ${weeks} weeks`,
    shipsNow: 'In stock, ships within 3 days',
    finish: 'Finish',
    finishes: (count: number) => `${count} finishes`,
    details: 'Details',
    material: 'Material',
    dimensions: 'Dimensions',
    weight: 'Weight',
    designer: 'Designed by',
    care: 'Care',
    relatedArticles: 'Read more',
    moreFrom: (collection: string) => `More from ${collection.toLowerCase()}`,
    viewCollection: 'View the collection',
    readMore: 'Read the story',
    minutes: (minutes: number) => `${minutes} min read`,
    by: 'By',
    viewProduct: 'View product',
    products: (count: number) => `${count} pieces`,
    englishOnly: 'In English',
    emailPlaceholder: 'Your email address',
    footerNote:
      'A fictional brand, made to show what Alinea can do. Photography from Unsplash.',
    footerMade: 'Made slowly in Ghent',
    categories: {
      craft: 'Craft',
      materials: 'Materials',
      homes: 'Homes',
      studio: 'Studio news'
    },
    materials: {
      oak: 'Solid oak',
      walnut: 'Solid walnut',
      ash: 'Ash',
      ceramic: 'Glazed stoneware',
      linen: 'Belgian linen',
      cane: 'Oak and woven cane'
    }
  },
  nl: {
    languages: 'Taal',
    menu: 'Menu',
    from: 'Vanaf',
    price: 'Prijs',
    addToBasket: 'In winkelmand',
    madeToOrder: 'Op bestelling',
    shipsIn: (weeks: number) =>
      `Op bestelling gemaakt, levering binnen ${weeks} weken`,
    shipsNow: 'Op voorraad, verzonden binnen 3 dagen',
    finish: 'Afwerking',
    finishes: (count: number) => `${count} afwerkingen`,
    details: 'Details',
    material: 'Materiaal',
    dimensions: 'Afmetingen',
    weight: 'Gewicht',
    designer: 'Ontwerp',
    care: 'Onderhoud',
    relatedArticles: 'Lees verder',
    moreFrom: (collection: string) => `Meer uit ${collection.toLowerCase()}`,
    viewCollection: 'Bekijk de collectie',
    readMore: 'Lees het verhaal',
    minutes: (minutes: number) => `${minutes} min lezen`,
    by: 'Door',
    viewProduct: 'Bekijk product',
    products: (count: number) => `${count} stukken`,
    englishOnly: 'In het Engels',
    emailPlaceholder: 'Je e-mailadres',
    footerNote:
      'Een fictief merk, gemaakt om te tonen wat Alinea kan. Foto’s van Unsplash.',
    footerMade: 'Traag gemaakt in Gent',
    categories: {
      craft: 'Vakmanschap',
      materials: 'Materialen',
      homes: 'Wonen',
      studio: 'Atelier'
    },
    materials: {
      oak: 'Massief eiken',
      walnut: 'Massief notelaar',
      ash: 'Es',
      ceramic: 'Geglazuurd steengoed',
      linen: 'Belgisch linnen',
      cane: 'Eiken en geweven riet'
    }
  },
  fr: {
    languages: 'Langue',
    menu: 'Menu',
    from: 'À partir de',
    price: 'Prix',
    addToBasket: 'Ajouter au panier',
    madeToOrder: 'Sur commande',
    shipsIn: (weeks: number) =>
      `Fabriqué sur commande, livré sous ${weeks} semaines`,
    shipsNow: 'En stock, expédié sous 3 jours',
    finish: 'Finition',
    finishes: (count: number) => `${count} finitions`,
    details: 'Détails',
    material: 'Matériau',
    dimensions: 'Dimensions',
    weight: 'Poids',
    designer: 'Design',
    care: 'Entretien',
    relatedArticles: 'À lire aussi',
    moreFrom: (collection: string) => `Aussi dans ${collection.toLowerCase()}`,
    viewCollection: 'Voir la collection',
    readMore: 'Lire l’article',
    minutes: (minutes: number) => `${minutes} min de lecture`,
    by: 'Par',
    viewProduct: 'Voir le produit',
    products: (count: number) => `${count} pièces`,
    englishOnly: 'En anglais',
    emailPlaceholder: 'Votre adresse e-mail',
    footerNote:
      'Une marque fictive, créée pour montrer ce que permet Alinea. Photos : Unsplash.',
    footerMade: 'Fait lentement à Gand',
    categories: {
      craft: 'Savoir-faire',
      materials: 'Matériaux',
      homes: 'Intérieurs',
      studio: "Vie de l'atelier"
    },
    materials: {
      oak: 'Chêne massif',
      walnut: 'Noyer massif',
      ash: 'Frêne',
      ceramic: 'Grès émaillé',
      linen: 'Lin belge',
      cane: 'Chêne et cannage'
    }
  }
}

export type DemoStrings = (typeof strings)['en']

export function demoStrings(locale: DemoLocale): DemoStrings {
  return strings[locale]
}

const intlLocale: Record<DemoLocale, string> = {
  en: 'en-BE',
  nl: 'nl-BE',
  fr: 'fr-BE'
}

export function formatPrice(locale: DemoLocale, value: number | null) {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value ?? 0)
}

export function formatDate(locale: DemoLocale, date: string | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(date))
}

export const demoLocaleLabels: Record<DemoLocale, string> = {
  en: 'English',
  nl: 'Nederlands',
  fr: 'Français'
}
