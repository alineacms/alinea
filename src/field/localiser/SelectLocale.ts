/**
 * Returns the locale of `locales` matching `locale` (case insensitive),
 * falling back to the first locale.
 */
export function selectLocale<Locale extends string>(
  locale: string | null | undefined,
  locales: ReadonlyArray<Locale>
): Locale {
  const matchingLocale = locales.find(
    candidate => candidate.toLowerCase() === locale?.toLowerCase()
  )
  return matchingLocale ?? locales[0]
}
