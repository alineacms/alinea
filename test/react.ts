import {GlobalRegistrator} from '@happy-dom/global-registrator'

// The window stays registered for the test files that run later: keep the
// runtime's own networking, which those use to talk to real servers.
const {fetch, Request, Response, Headers} = globalThis
GlobalRegistrator.register()
Object.assign(globalThis, {fetch, Request, Response, Headers})

const testingLibrary = await import('@testing-library/react')

export const render = testingLibrary.render
export const screen = testingLibrary.screen
export const within = testingLibrary.within
export const waitFor = testingLibrary.waitFor
export const fireEvent = testingLibrary.fireEvent
export const act = testingLibrary.act
export const cleanup = testingLibrary.cleanup
