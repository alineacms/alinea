/** Letters that do not decompose into a base letter and accents */
const foldedLetters: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i'
}

/**
 * Letters some languages order after z, in their alphabetical order. They
 * sort after every Latin letter, before other scripts.
 */
const lettersAfterZ: Record<string, Array<string>> = {
  da: ['æ', 'ø', 'å'],
  nb: ['æ', 'ø', 'å'],
  nn: ['æ', 'ø', 'å'],
  no: ['æ', 'ø', 'å'],
  sv: ['å', 'ä', 'ö'],
  fi: ['å', 'ä', 'ö'],
  is: ['æ', 'ö']
}

/**
 * Letters that are letters of their own rather than a letter with an accent,
 * such as the Russian й, which comes between и and к
 */
const distinctLetters = ['й']

// Stand-ins in the private use area, kept while accents are removed
const placeholderBase = 0xe000
const placeholders = /[-]/gu
// Accents of Latin, Greek and Cyrillic letters only: in other scripts, such
// as Devanagari and Thai, vowels are written as marks
const accents =
  /(?<=[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]\p{M}*)\p{M}+/gu
const leadingSymbols = /^[^\p{L}\p{N}\p{Co}]+/u
const digits = /\p{Nd}+/gu
const folded = new RegExp(`[${Object.keys(foldedLetters).join('')}]`, 'g')

/**
 * A key that orders text the way editors expect when compared byte by byte:
 * case and accents are ignored, leading punctuation such as quotes is skipped
 * and numbers compare by their value, so "Item 2" comes before "Item 10".
 * With a `locale`, letters its alphabet orders after z (eg. æ, ø and å in
 * Danish) sort there.
 */
export function textSortKey(text: string, locale?: string | null): string {
  const language = locale?.toLowerCase().split(/[-_]/)[0]
  const afterZ = (language && lettersAfterZ[language]) || []
  const kept = [...distinctLetters, ...afterZ]
  const restore = kept.map((letter, index) =>
    index < distinctLetters.length
      ? letter
      : // After z (0x7a) in byte order, in the order of the alphabet
        String.fromCharCode(0x7b + index - distinctLetters.length)
  )
  let base = text.toLowerCase()
  kept.forEach((letter, index) => {
    base = base.replaceAll(letter, String.fromCharCode(placeholderBase + index))
  })
  base = base
    .normalize('NFKD')
    .replace(accents, '')
    .replace(folded, letter => foldedLetters[letter])
    .trim()
  const words = base.replace(leadingSymbols, '') || base
  // Numbers are prefixed with their number of digits, without leading zeros
  return words
    .replace(digits, run => {
      const value = run.replace(/^0+(?=\d)/, '')
      return String(value.length).padStart(2, '0') + value
    })
    .replace(
      placeholders,
      char => restore[char.charCodeAt(0) - placeholderBase] ?? char
    )
}
