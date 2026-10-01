import PLazy from 'p-lazy'
import type {ILanguageRegistration} from 'shiki'
import languageCss from 'shiki/languages/css.tmLanguage.json'
import languageShellScript from 'shiki/languages/shellscript.tmLanguage.json'
import languageTsx from 'shiki/languages/tsx.tmLanguage.json'
import {theme} from './ShikiTheme'

type Grammar = NonNullable<ILanguageRegistration['grammar']>

// The grammar files are typed as plain JSON
function grammar(json: object) {
  return json as Grammar
}

export const codeHighlighter = PLazy.from(async () => {
  const {getHighlighter} = await import('shiki')
  return getHighlighter({
    theme: {
      ...theme,
      type: 'light',
      settings: [],
      // Placeholders Shiki swaps for --shiki-* variables, see global.scss
      fg: '#000001',
      bg: '#000002',
      colors: {
        ...theme.colors,
        'editor.foreground': '#000001',
        'editor.background': '#000002'
      }
    },
    langs: [
      {id: 'tsx', scopeName: 'source.tsx', grammar: grammar(languageTsx)},
      {
        id: 'shellscript',
        scopeName: 'source.shell',
        grammar: grammar(languageShellScript)
      },
      {id: 'css', scopeName: 'source.css', grammar: grammar(languageCss)}
    ]
  })
})

// Maps the language set on a code block to one of the loaded grammars,
// anything unset or unknown is highlighted as tsx
const codeLanguages: Record<string, string> = {
  tsx: 'tsx',
  ts: 'tsx',
  typescript: 'tsx',
  jsx: 'tsx',
  js: 'tsx',
  javascript: 'tsx',
  json: 'tsx',
  css: 'css',
  shellscript: 'shellscript',
  shell: 'shellscript',
  bash: 'shellscript',
  sh: 'shellscript',
  text: 'text',
  txt: 'text',
  plaintext: 'text',
  markdown: 'text',
  md: 'text'
}

export function codeLanguage(language: string | null | undefined) {
  const key = language?.trim().toLowerCase() ?? ''
  return codeLanguages[key] ?? 'tsx'
}
