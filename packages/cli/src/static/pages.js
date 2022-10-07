import {backend} from './backend.js'
export function initPages(previewToken) {
  return backend.loadPages({previewToken})
}
