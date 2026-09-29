import {cleanup, render} from '#test/react.js'
import {afterEach, expect, spyOn, test} from 'bun:test'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from './Resizable.js'

afterEach(cleanup)

function Group({size, label}: {size: number; label: string}) {
  return (
    <ResizablePanelGroup>
      <ResizablePanel key="side" size={size}>
        {label}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel key="main">Main</ResizablePanel>
    </ResizablePanelGroup>
  )
}

test('ResizablePanelGroup does not measure or decorate on unrelated renders', () => {
  const view = render(<Group size={200} label="a" />)
  const measure = spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  const query = spyOn(HTMLElement.prototype, 'querySelectorAll')
  try {
    view.rerender(<Group size={200} label="b" />)
    view.rerender(<Group size={200} label="c" />)
    expect(measure).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  } finally {
    measure.mockRestore()
    query.mockRestore()
  }
})
