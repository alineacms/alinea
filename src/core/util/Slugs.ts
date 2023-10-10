// Anything that is not a letter, digit or emoji is considered a separator
// A special case is made for punctuation which can be included in emojis,
// which in this case would be followed by the emoji variation selector
// For example we'll strip # but not #️⃣
const strip = /([^\p{L}\p{N}\p{Emoji}\p{Emoji_Component}]|\p{P}(?!\u{fe0f}))+/gu
const separator = '-'
const trim = new RegExp(`^${separator}+|${separator}+$`, 'g')

export function isSeparator(char: string): boolean {
  return strip.test(char)
}

export function slugify(input: string): string {
  return input.replace(strip, separator).replace(trim, '').toLowerCase()
}
