import type {Pages} from '@alinea/backend'
import {Expr} from '@alinea/store'
import {getHighlighter} from 'shiki'
import tsxLanguage from 'shiki/languages/tsx.tmLanguage.json'
import {theme} from '../types/ShikiTheme'

const highlighter = getHighlighter({
  theme: {
    ...theme,
    type: 'light',
    settings: [],
    fg: '#24292f',
    bg: '#fbf9f9'
  },
  langs: [{id: 'tsx', scopeName: 'source.tsx', grammar: tsxLanguage as any}]
})

export function transformCode(field: Expr<string>, pages: Pages<any>) {
  return pages.process(field, async code => {
    if (!code) return ''
    const {codeToHtml} = await highlighter
    return codeToHtml(code, {lang: 'tsx'})
  })
}
