'use client'

import styler from '@alinea/styler'
import {useEffect, useId, useRef, useState, useSyncExternalStore} from 'react'
import {IcRoundKeyboardArrowDown, IcRoundKeyboardArrowRight} from '@/icons'
import css from './ChangelogNav.module.scss'
import {
  type ChangelogRelease,
  formatReleaseDate,
  groupReleasesBySeries,
  releaseSeries
} from './parseChangelog'

const styles = styler(css)

/** Series holding one of this many latest releases start expanded */
const RECENT_RELEASES = 3
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
 * Releases grouped per major.minor series. The series of the latest releases
 * and the series of the release in view are expanded, the others fold their
 * patch releases away until opened. On small screens the list becomes a
 * select that jumps to a release.
 */
export function ChangelogNav({releases}: ChangelogNavProps) {
  const series = groupReleasesBySeries(releases)
  const latest = releases[0]?.version
  const active = useActiveRelease(releases)
  const activeSeries = active ? releaseSeries(active) : undefined
  const recentSeries = new Set(
    releases
      .slice(0, RECENT_RELEASES)
      .map(release => releaseSeries(release.version))
  )
  // Series the visitor opened or closed themselves
  const [toggled, setToggled] = useState(new Map<string, boolean>())
  const listRef = useRef<HTMLUListElement>(null)
  const selectId = useId()

  function isOpen(name: string) {
    return (
      toggled.get(name) ?? (recentSeries.has(name) || name === activeSeries)
    )
  }

  // Keep the current release in view within the list's own scroll area,
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
  }, [active])

  function renderLink(release: ChangelogNavRelease) {
    const isCurrent = release.version === active
    return (
      <a
        href={`#${release.version}`}
        className={styles.link()}
        aria-current={isCurrent ? 'location' : undefined}
        data-current={isCurrent || undefined}
      >
        <span className={styles.link.version()}>{release.version}</span>
        {release.version === latest ? (
          <span className={styles.link.latest()}>Latest</span>
        ) : (
          release.date && (
            <span className={styles.link.date()}>
              {formatReleaseDate(release.date, true)}
            </span>
          )
        )}
      </a>
    )
  }

  return (
    <div className={styles.root()}>
      <nav aria-label="Releases" className={styles.nav()}>
        <span className={styles.nav.title()}>Releases</span>
        <ul ref={listRef} className={styles.list()}>
          {series.map(group => {
            if (group.releases.length === 1)
              return (
                <li key={group.name} className={styles.list.item()}>
                  {renderLink(group.releases[0])}
                </li>
              )
            const open = isOpen(group.name)
            const holdsCurrent = group.name === activeSeries
            return (
              <li key={group.name} className={styles.list.item()}>
                <details
                  className={styles.series()}
                  open={open}
                  onToggle={event => {
                    const next = event.currentTarget.open
                    // Ignore the toggle events caused by our own open prop
                    if (next === open) return
                    setToggled(toggled =>
                      new Map(toggled).set(group.name, next)
                    )
                  }}
                >
                  <summary
                    className={styles.series.summary()}
                    data-current={(holdsCurrent && !open) || undefined}
                  >
                    <span className={styles.series.summary.label()}>
                      {group.name}
                    </span>
                    <span className={styles.series.summary.count()}>
                      {group.releases.length} releases
                    </span>
                    <IcRoundKeyboardArrowRight
                      aria-hidden
                      className={styles.series.summary.icon()}
                    />
                  </summary>
                  <ul className={styles.series.list()}>
                    {group.releases.map(release => (
                      <li
                        key={release.version}
                        className={styles.series.list.item()}
                      >
                        {renderLink(release)}
                      </li>
                    ))}
                  </ul>
                </details>
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
            value={active}
            onChange={event => jumpTo(event.currentTarget.value)}
          >
            {series.map(group => (
              <optgroup key={group.name} label={`${group.name}.x`}>
                {group.releases.map(release => (
                  <option key={release.version} value={release.version}>
                    {release.version}
                    {release.version === latest
                      ? ' (latest)'
                      : release.date
                        ? ` · ${formatReleaseDate(release.date, true)}`
                        : ''}
                  </option>
                ))}
              </optgroup>
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
