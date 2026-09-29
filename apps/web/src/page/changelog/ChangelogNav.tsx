'use client'

import styler from '@alinea/styler'
import {useEffect, useId, useRef, useSyncExternalStore} from 'react'
import {IcRoundKeyboardArrowDown} from '@/icons'
import css from './ChangelogNav.module.scss'
import {
  type ChangelogRelease,
  formatReleaseDate,
  groupReleasesBySeries,
  releaseSeries
} from './parseChangelog'

const styles = styler(css)

/**
 * A release becomes current once it scrolls within this distance of where a
 * link to it lands (its scroll margin)
 */
const ACTIVE_SLACK = 24

export interface ChangelogNavRelease {
  version: ChangelogRelease['version']
  date: ChangelogRelease['date']
}

export interface ChangelogNavProps {
  releases: Array<ChangelogNavRelease>
}

/**
 * One entry per major.minor series, linking to its newest release. Point
 * releases are listed on the page but not in the nav. On small screens the
 * list becomes a select that jumps to a series.
 */
export function ChangelogNav({releases}: ChangelogNavProps) {
  const series = groupReleasesBySeries(releases)
  const latest = series[0]?.name
  const active = useActiveRelease(releases)
  const activeSeries = active ? releaseSeries(active) : latest
  const listRef = useRef<HTMLUListElement>(null)
  const selectId = useId()

  // Keep the current series in view within the list's own scroll area,
  // only when it changes so browsing the list by hand is left alone
  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[data-current]')
    if (!list || !current) return
    const bounds = list.getBoundingClientRect()
    const rect = current.getBoundingClientRect()
    if (rect.top < bounds.top) list.scrollTop += rect.top - bounds.top - 8
    else if (rect.bottom > bounds.bottom)
      list.scrollTop += rect.bottom - bounds.bottom + 8
  }, [activeSeries])

  return (
    <div className={styles.root()}>
      <nav aria-label="Releases" className={styles.nav()}>
        <span className={styles.nav.title()}>Releases</span>
        <ul ref={listRef} className={styles.list()}>
          {series.map(group => {
            const isCurrent = group.name === activeSeries
            // The minor release that started the series, eg. 1.6.0
            const date = group.releases.at(-1)?.date
            return (
              <li key={group.name} className={styles.list.item()}>
                <a
                  href={`#${group.releases[0].version}`}
                  className={styles.link()}
                  aria-current={isCurrent ? 'location' : undefined}
                  data-current={isCurrent || undefined}
                >
                  <span className={styles.link.version()}>{group.name}</span>
                  {group.name === latest ? (
                    <span className={styles.link.latest()}>Latest</span>
                  ) : (
                    date && (
                      <span className={styles.link.date()}>
                        {formatReleaseDate(date, true)}
                      </span>
                    )
                  )}
                </a>
              </li>
            )
          })}
        </ul>
        <a
          href="https://github.com/alineacms/alinea/releases"
          className={styles.nav.all()}
        >
          All releases on GitHub →
        </a>
      </nav>
      <div className={styles.jump()}>
        <label htmlFor={selectId} className={styles.jump.label()}>
          Release
        </label>
        <div className={styles.jump.field()}>
          <select
            id={selectId}
            className={styles.jump.select()}
            value={activeSeries}
            onChange={event => {
              const group = series.find(
                group => group.name === event.currentTarget.value
              )
              if (group) jumpTo(group.releases[0].version)
            }}
          >
            {series.map(group => (
              <option key={group.name} value={group.name}>
                {group.name}
                {group.name === latest ? ' (latest)' : ''}
              </option>
            ))}
          </select>
          <IcRoundKeyboardArrowDown
            aria-hidden
            className={styles.jump.field.icon()}
          />
        </div>
      </div>
    </div>
  )
}

function jumpTo(version: string) {
  const section = document.getElementById(version)
  if (!section) return
  section.scrollIntoView({block: 'start'})
  history.replaceState(null, '', `#${version}`)
}

/** The version of the release section currently at the top of the page */
function useActiveRelease(releases: Array<ChangelogNavRelease>) {
  const first = releases[0]?.version
  return useSyncExternalStore(
    subscribeToScroll,
    () => currentRelease(releases) ?? first,
    () => first
  )
}

function subscribeToScroll(onChange: () => void) {
  let frame = 0
  function schedule() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        onChange()
      })
  }
  window.addEventListener('scroll', schedule, {passive: true})
  window.addEventListener('resize', schedule)
  window.addEventListener('hashchange', schedule)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('hashchange', schedule)
  }
}

function currentRelease(releases: Array<ChangelogNavRelease>) {
  // Near the end of the page the last sections cannot scroll up to the
  // offset, there the upper half of the viewport counts
  const atEnd =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2
  let current = releases[0]?.version
  for (const release of releases) {
    const section = document.getElementById(release.version)
    if (!section) continue
    const offset = atEnd
      ? window.innerHeight / 2
      : Number.parseFloat(getComputedStyle(section).scrollMarginTop) +
        ACTIVE_SLACK
    if (section.getBoundingClientRect().top > offset) break
    current = release.version
  }
  // A linked release that is in view wins at the end of the page
  const linked = decodeURIComponent(location.hash.slice(1))
  const target = linked && document.getElementById(linked)
  if (
    atEnd &&
    target &&
    releases.some(release => release.version === linked) &&
    target.getBoundingClientRect().top < window.innerHeight
  )
    return linked
  return current
}
