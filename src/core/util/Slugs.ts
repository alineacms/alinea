// Anything that is not a letter, digit or emoji is considered a separator
// A special case is made for punctuation which can be included in emojis,
// which in this case would be followed by the emoji variation selector
// For example we'll strip # but not #️⃣
const strip =
  /([^\p{L}\p{N}\p{M}\p{Emoji}\p{Emoji_Component}]|\p{P}(?!\u{fe0f}))+/u
const stripGlobal = new RegExp(strip.source, 'gu')
// Soft hyphens only mark where a word may break, they are not separators
const ignore = /['’\u00ad]/
const ignoreGlobal = new RegExp(ignore.source, 'g')
const stripAccents = /(\p{Script=Latin})\p{M}+/gu
const separator = '-'
const trim = new RegExp(`^${separator}+|${separator}+$`, 'g')

export function isSeparator(char: string): boolean {
  return !ignore.test(char) && strip.test(char)
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(stripAccents, '$1')
    .replace(ignoreGlobal, '')
    .replace(stripGlobal, separator)
    .replace(trim, '')
    .toLowerCase()
}
