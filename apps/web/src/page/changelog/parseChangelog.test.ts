/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {groupReleasesBySeries, parseChangelog} from './parseChangelog'

test('releases without subsections become a single unlabeled group', () => {
  const releases = parseChangelog(`# Changelog

## [1.6.2]
- Fix search results turning up empty
- Show children indicator in tree

## [1.6.1]
- Previous release mistakenly included features
`)
  expect(releases).toEqual([
    {
      version: '1.6.2',
      date: null,
      groups: [
        {
          kind: null,
          label: null,
          items: [
            'Fix search results turning up empty',
            'Show children indicator in tree'
          ]
        }
      ]
    },
    {
      version: '1.6.1',
      date: null,
      groups: [
        {
          kind: null,
          label: null,
          items: ['Previous release mistakenly included features']
        }
      ]
    }
  ])
})

test('subsections map to New, Improved and Fixed', () => {
  const [release] = parseChangelog(`## [2.0.0]
### Added
- Roles
### New
- Toolbars
### Changed
- Faster boot
### Improved
- Search
### Fixed
- Link order
### Removed
- Old option
`)
  expect(release.groups.map(group => [group.kind, group.label])).toEqual([
    ['new', 'New'],
    ['new', 'New'],
    ['improved', 'Improved'],
    ['improved', 'Improved'],
    ['fixed', 'Fixed'],
    ['other', 'Removed']
  ])
  expect(release.groups[4].items).toEqual(['Link order'])
})

test('multi-line bullets join into one item', () => {
  const [release] = parseChangelog(`## [1.7.0]
- Add user roles. Permissions can now be scoped by
  workspace and root.
- Fix removing field contents. Pass undefined:

  \`\`\`tsx
  set: {removeMe: undefined}
  \`\`\`
- Short one
`)
  expect(release.groups[0].items).toEqual([
    'Add user roles. Permissions can now be scoped by\nworkspace and root.',
    'Fix removing field contents. Pass undefined:\n\n```tsx\nset: {removeMe: undefined}\n```',
    'Short one'
  ])
})

test('dates are optional', () => {
  const releases = parseChangelog(`## [1.7.0] - 2026-06-26
- Dated
## [1.6.4]
- Undated
`)
  expect(releases.map(release => [release.version, release.date])).toEqual([
    ['1.7.0', '2026-06-26'],
    ['1.6.4', null]
  ])
})

test('releases are grouped by their major.minor series', () => {
  const series = groupReleasesBySeries([
    {version: '2.0.0'},
    {version: '2.0.0-beta.1'},
    {version: '1.6.1'},
    {version: '1.6.0'},
    {version: '1.0.11'}
  ])
  expect(series).toEqual([
    {name: '2.0', releases: [{version: '2.0.0'}, {version: '2.0.0-beta.1'}]},
    {name: '1.6', releases: [{version: '1.6.1'}, {version: '1.6.0'}]},
    {name: '1.0', releases: [{version: '1.0.11'}]}
  ])
})
