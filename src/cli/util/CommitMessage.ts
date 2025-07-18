export function parseCoAuthoredBy(
  commitMessage: string
): {email: string; name: string} | undefined {
  // Regular expression to match "Co-authored-by: Name <email@example.com>"
  // - Co-authored-by: Matches the literal string "Co-authored-by:".
  // - \s*: Matches any whitespace characters (spaces, tabs, newlines) zero or more times.
  // - (.+?): Captures the name (non-greedy, to stop before the email's angle bracket).
  // - \s*<: Matches whitespace and the opening angle bracket for the email.
  // - (\S+@\S+\.\S+): Captures the email address (non-whitespace characters, @, non-whitespace, ., non-whitespace).
  // - >: Matches the closing angle bracket.
  const regex = /Co-authored-by:\s*(.+?)\s*<(\S+@\S+\.\S+)>/

  const match = commitMessage.match(regex)

  if (match && match.length >= 3) {
    // match[1] will be the captured name
    // match[2] will be the captured email
    const name = match[1].trim()
    const email = match[2].trim()
    return {name, email}
  }

  // If no match is found, return undefined
  return undefined
}
