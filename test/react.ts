import {GlobalRegistrator} from '@happy-dom/global-registrator'

GlobalRegistrator.register()

const testingLibrary = await import('@testing-library/react')

export const render = testingLibrary.render
export const screen = testingLibrary.screen
export const within = testingLibrary.within
export const waitFor = testingLibrary.waitFor
export const cleanup = testingLibrary.cleanup
