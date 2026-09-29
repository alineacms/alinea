import PLazy from 'p-lazy'
import languageCss from 'shiki/languages/css.tmLanguage.json'
import languageShellScript from './ShikiBashLanguage'
import {theme} from './ShikiTheme'
import languageTsx from './ShikiTsxLanguage'

export const codeHighlighter = PLazy.from(async () => {
  const {getHighlighter} = await import('shiki')
  return getHighlighter({
    theme: {
      ...theme,
      type: 'light',
      settings: [],
      fg: '#1E232A',
      bg: 'white',
      colors: {
        ...theme.colors,
        'editor.background': 'var(--web-code-background)'
      }
    },
    langs: [
      {id: 'tsx', scopeName: 'source.tsx', grammar: languageTsx},
      {
        id: 'shellscript',
        scopeName: 'source.shell',
        grammar: languageShellScript
      },
      {id: 'css', scopeName: 'source.css', grammar: languageCss}
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
