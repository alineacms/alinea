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

const accents = /\p{M}+/gu
const leadingSymbols = /^[^\p{L}\p{N}]+/u
const digits = /\p{Nd}+/gu
const folded = new RegExp(`[${Object.keys(foldedLetters).join('')}]`, 'g')

/**
 * A key that orders text the way editors expect when compared byte by byte:
 * case and accents are ignored, leading punctuation such as quotes is skipped
 * and numbers compare by their value, so "Item 2" comes before "Item 10".
 */
export function textSortKey(text: string): string {
  const base = text
    .normalize('NFKD')
    .replace(accents, '')
    .toLowerCase()
    .replace(folded, letter => foldedLetters[letter])
    .trim()
  const words = base.replace(leadingSymbols, '') || base
  // Numbers are prefixed with their number of digits, without leading zeros
  return words.replace(digits, run => {
    const value = run.replace(/^0+(?=\d)/, '')
    return String(value.length).padStart(2, '0') + value
  })
}
