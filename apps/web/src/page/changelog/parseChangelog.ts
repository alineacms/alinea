export type ChangelogGroupKind = 'new' | 'improved' | 'fixed' | 'other'

export interface ChangelogGroup {
  /** Null when the release has no subsections */
  kind: ChangelogGroupKind | null
  label: string | null
  /** Markdown source of each bullet, continuation lines dedented and joined */
  items: Array<string>
}

export interface ChangelogRelease {
  version: string
  /** ISO date (YYYY-MM-DD) when present in the heading */
  date: string | null
  groups: Array<ChangelogGroup>
}

const releaseHeading =
  /^##\s+\[?(\d+\.\d+\.\d+[^\]\s]*)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/
const subsectionHeading = /^###\s+(.+?)\s*$/
const bulletStart = /^[-*]\s+(.*)$/

const groupKinds: Record<string, ChangelogGroupKind> = {
  added: 'new',
  new: 'new',
  changed: 'improved',
  improved: 'improved',
  fixed: 'fixed'
}

const groupLabels: Record<ChangelogGroupKind, string | null> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
  other: null
}

export function parseChangelog(markdown: string): Array<ChangelogRelease> {
  const releases: Array<ChangelogRelease> = []
  let release: ChangelogRelease | null = null
  let group: ChangelogGroup | null = null
  let item: Array<string> | null = null

  function closeItem() {
    if (!item || !group) return
    const source = item.join('\n').trim()
    if (source) group.items.push(source)
    item = null
  }

  function closeGroup() {
    closeItem()
    if (release && group && group.items.length > 0) release.groups.push(group)
    group = null
  }

  function ensureGroup(): ChangelogGroup {
    if (!group) group = {kind: null, label: null, items: []}
    return group
  }

  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const releaseMatch = releaseHeading.exec(line)
    if (releaseMatch) {
      closeGroup()
      release = {
        version: releaseMatch[1],
        date: releaseMatch[2] ?? null,
        groups: []
      }
      releases.push(release)
      continue
    }
    // Ignore anything before the first release or under other h1/h2 headings
    if (!release) continue
    if (/^#{1,2}\s/.test(line)) {
      closeGroup()
      release = null
      continue
    }
    const subsectionMatch = subsectionHeading.exec(line)
    if (subsectionMatch) {
      closeGroup()
      const heading = subsectionMatch[1]
      const kind = groupKinds[heading.toLowerCase()] ?? 'other'
      group = {kind, label: groupLabels[kind] ?? heading, items: []}
      continue
    }
    const bulletMatch = bulletStart.exec(line)
    if (bulletMatch) {
      ensureGroup()
      closeItem()
      item = [bulletMatch[1]]
      continue
    }
    if (item) {
      // Continuation lines are indented by two spaces; blank lines are kept so
      // paragraphs and code blocks inside a bullet survive
      item.push(line.startsWith('  ') ? line.slice(2) : line.trimStart())
      continue
    }
    if (line.trim()) {
      // Loose text without a bullet becomes its own item
      ensureGroup()
      item = [line.trim()]
    }
  }
  closeGroup()
  return releases
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Formats an ISO date as "26 June 2026", or "Jun 2026" when short */
export function formatReleaseDate(date: string, short = false): string {
  const [year, month, day] = date.split('-').map(Number)
  const name = monthNames[month - 1]
  if (!name) return date
  if (short) return `${name.slice(0, 3)} ${year}`
  return `${day} ${name} ${year}`
}
