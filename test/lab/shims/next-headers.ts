/** `next/headers` for lab isolates, answering for the render in progress. */
import {renderScope} from './requestScope.js'

export async function draftMode() {
  return {
    isEnabled: renderScope.draft,
    enable() {
      renderScope.draft = true
    },
    disable() {
      renderScope.draft = false
    }
  }
}

export async function cookies() {
  return {
    getAll: () => renderScope.cookies,
    get: (name: string) => renderScope.cookies.find(c => c.name === name)
  }
}

export async function headers() {
  return new Headers()
}
