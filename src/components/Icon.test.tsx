import {cleanup, render} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {IcRoundCheck} from '#/dashboard/icons.js'
import {Icon} from './Icon.js'

afterEach(cleanup)

test('Icon keeps its own class next to a custom className', () => {
  const view = render(
    <>
      <Icon icon={IcRoundCheck} data-testid="plain" />
      <Icon icon={IcRoundCheck} data-testid="custom" className="custom" />
    </>
  )
  const plain = view.getByTestId('plain').getAttribute('class')!.trim()
  const custom = view.getByTestId('custom').getAttribute('class')!.split(' ')
  expect(plain).toBeTruthy()
  expect(custom).toContain(plain)
  expect(custom).toContain('custom')
})
