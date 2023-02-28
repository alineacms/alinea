import type {Pages} from 'alinea/backend'
import {Expr} from 'alinea/store'
import lzstring from 'lz-string'

export function transformToUrl(field: Expr<string>, pages: Pages<any>) {
  return pages.process(field, code => {
    return lzstring.compressToEncodedURIComponent(code)
  })
}
