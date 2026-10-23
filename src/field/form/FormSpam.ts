/** Hidden inputs that `<Form>` adds to catch spam */
export const formSpam = {
  /** Left empty by people, filled in by bots that fill in every input */
  honeypot: '_alinea_website',
  /** When the form was shown, a form sent within seconds is not a person */
  shownAt: '_alinea_shown'
}

/** Whether a submission looks like it was sent by a bot */
export function isSpam(data: FormData, now = Date.now()): boolean {
  const honeypot = data.get(formSpam.honeypot)
  if (typeof honeypot === 'string' && honeypot !== '') return true
  const shownAt = Number(data.get(formSpam.shownAt))
  // A form without the time it was shown is not checked, eg. one sent by
  // markup of its own; a person needs more than two seconds
  return Number.isFinite(shownAt) && shownAt > 0 && now - shownAt < 2000
}
