import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {Dialog, DialogTrigger} from '#/components.js'
import {StoryProvider} from '../StoryProvider.js'
import {ExternalLinkPicker} from './ExternalLinkPicker.js'

afterEach(cleanup)

test.each(['#abc', '/about', 'https://example.org/path'])(
  'reports invalid URLs and preserves valid input %s',
  value => {
    const onConfirm = mock(() => {})
    render(
      <StoryProvider>
        <Dialog defaultOpen>
          <DialogTrigger>Open</DialogTrigger>
          <ExternalLinkPicker selectionMode="single" onConfirm={onConfirm} />
        </Dialog>
      </StoryProvider>
    )
    const url = screen.getByRole('textbox', {name: 'URL *'})
    const label = screen.getByRole('textbox', {name: 'Label *'})
    expect(
      screen.queryByText('Enter a valid URL, for example https://example.com')
    ).toBeNull()
    fireEvent.change(label, {target: {value: 'About'}})
    fireEvent.change(url, {target: {value: 'https://'}})
    expect(
      screen.getByText('Enter a valid URL, for example https://example.com')
    ).toBeDefined()
    fireEvent.submit(url.closest('form')!)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.change(url, {target: {value}})
    expect(
      screen.queryByText('Enter a valid URL, for example https://example.com')
    ).toBeNull()
    fireEvent.submit(url.closest('form')!)
    expect(onConfirm).toHaveBeenCalledWith({
      url: value,
      title: 'About',
      target: '_blank'
    })
  }
)
