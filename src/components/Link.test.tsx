import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Link} from './Link.js'

afterEach(cleanup)

test('Link passes native anchor attributes', () => {
  render(
    <Link
      href="/about"
      id="about"
      title="About us"
      tabIndex={-1}
      lang="en"
      hrefLang="en"
      aria-current="page"
    >
      About
    </Link>
  )
  const link = screen.getByRole('link', {name: 'About'})
  expect(link.id).toBe('about')
  expect(link.getAttribute('title')).toBe('About us')
  expect(link.getAttribute('tabindex')).toBe('-1')
  expect(link.getAttribute('lang')).toBe('en')
  expect(link.getAttribute('hreflang')).toBe('en')
  expect(link.getAttribute('aria-current')).toBe('page')
})
