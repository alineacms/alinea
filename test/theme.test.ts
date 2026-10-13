import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'

// alinea/css is loaded on public pages too, its global rules may only apply
// inside elements with data-alinea-theme
const exempt = /^(@font-face|@import|body\[data-disable-transition)/

function selectors(file: string): Array<string> {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Drop declaration blocks, keeping the selectors of top level rules
    .replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, ';')
  return source
    .split(';')
    .map(selector => selector.trim())
    .filter(selector => selector && !exempt.test(selector))
}

test('theme and global styles are scoped to data-alinea-theme', () => {
  const rules = [
    ...selectors('../src/theme.css'),
    ...selectors('../src/dashboard/global.css')
  ]
  expect(rules.length).toBeGreaterThan(5)
  for (const rule of rules) expect(rule).toContain('data-alinea-theme')
})
