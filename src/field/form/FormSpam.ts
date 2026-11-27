/** Hidden inputs that `<Form>` adds to catch spam */
export const formSpam = {
  /** Left empty by people, filled in by bots that fill in every input */
  honeypot: '_alinea_website',
  /** When the form was shown, a form sent within seconds is not a person */
  shownAt: '_alinea_shown'
}

/** A hidden input `<Form>` adds with the address of the page it is on */
export const formPage = '_alinea_page'

/** Why a submission looks like it was sent by a bot, if it does */
export function spamReason(
  data: FormData,
  now = Date.now()
): string | undefined {
  const honeypot = data.get(formSpam.honeypot)
  if (typeof honeypot === 'string' && honeypot !== '')
    return `the hidden ${formSpam.honeypot} input was filled in`
  const shownAt = Number(data.get(formSpam.shownAt))
  // A form without the time it was shown is not checked, eg. one sent by
  // markup of its own; a person needs more than two seconds
  if (Number.isFinite(shownAt) && shownAt > 0 && now - shownAt < 2000)
    return 'it was sent within 2 seconds of showing the form'
}
