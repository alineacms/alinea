import {Elevation, ProgressCircle} from '@alinea/components'
import styler from '@alinea/styler'
import type {Config} from 'alinea/core/Config'
import {Entry, type EntryStatus} from 'alinea/core/Entry'
import {Field, type FieldOptions} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {entries} from 'alinea/core/util/Objects'
import type {CSSProperties} from 'react'
import {useEffect, useMemo, useState} from 'react'
import css from './EntryEditor.module.css'
import {EntryStatus as EntryStatusBadge} from './EntryStatus.js'

const styles = styler(css)

interface EntryEditorProps {
  graph: WriteableGraph
  config: Config
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

interface EntryEditorState {
  isLoading: boolean
  entry: EntryEditorRow | null
  errorMessage?: string
}

interface EntryEditorRow {
  id: string
  title: string
  type: string
  path: string
  status: EntryStatus
  main: boolean
  locale: string | null
  data: Record<string, unknown>
}

interface EntryEditorQueryRow {
  id: string
  title: string
  type: string
  path: string
  status: EntryStatus
  main: boolean
  locale: string | null
  data: unknown
}

interface EntrySection {
  id: string
  fields: Array<EntryFieldPlaceholder>
}

interface EntryFieldPlaceholder {
  key: string
  label: string
  width: number
  span: number
  required: boolean
  readOnly: boolean
  helpText?: string
  viewLabel: string
  valuePreview: string
}

interface FieldLayoutOptions extends FieldOptions<unknown> {
  width?: number
  help?: unknown
}

const entryEditorSelection = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  path: Entry.path,
  status: Entry.status,
  main: Entry.main,
  locale: Entry.locale,
  data: Entry.data
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

async function queryEntryByRoute(
  graph: WriteableGraph,
  workspace: string,
  root: string,
  entry: string,
  locale: string | undefined
): Promise<EntryEditorRow | null> {
  const baseQuery = {
    workspace,
    root,
    locale,
    select: entryEditorSelection,
    status: 'preferDraft' as const
  }
  const byId = (await graph.first({
    ...baseQuery,
    id: entry
  })) as EntryEditorQueryRow | null
  if (byId) {
    return {...byId, data: asRecord(byId.data)}
  }
  const byPath = (await graph.first({
    ...baseQuery,
    path: entry
  })) as EntryEditorQueryRow | null
  if (!byPath) return null
  return {...byPath, data: asRecord(byPath.data)}
}

function clampWidth(width: number | undefined): number {
  if (typeof width !== 'number' || Number.isNaN(width) || width <= 0) return 1
  return Math.min(1, width)
}

function widthToSpan(width: number): number {
  return Math.max(1, Math.min(12, Math.round(width * 12)))
}

function fieldViewLabel(field: Field): string {
  const view = Field.view(field)
  if (typeof view !== 'string') return 'Custom view'
  const [, exportName] = view.split('#')
  if (exportName) return exportName
  const segments = view.split('/')
  return segments[segments.length - 1] || 'Field'
}

function stringifyPreview(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Empty'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `Array(${value.length})`
  }
  try {
    const serialized = JSON.stringify(value)
    if (!serialized) return 'Empty'
    return serialized.length > 72 ? `${serialized.slice(0, 69)}...` : serialized
  } catch {
    return 'Value unavailable'
  }
}

function helpText(help: unknown): string | undefined {
  if (typeof help === 'string') return help
  if (typeof help === 'number') return String(help)
  return undefined
}

function fieldOptions(field: Field): FieldLayoutOptions {
  return Field.options(field as Field<unknown, unknown, unknown, FieldLayoutOptions>)
}

function fieldStyle(field: EntryFieldPlaceholder): CSSProperties {
  return {gridColumn: `span ${field.span}`}
}

function buildSections(
  type: Type,
  entryData: Record<string, unknown>
): Array<EntrySection> {
  const result: Array<EntrySection> = []
  for (const section of Type.sections(type)) {
    const sectionFields: Array<EntryFieldPlaceholder> = []
    for (const [key, field] of entries(Section.fields(section))) {
      const options = fieldOptions(field)
      if (options.hidden) continue
      const width = clampWidth(options.width)
      sectionFields.push({
        key,
        label: Field.label(field),
        width,
        span: widthToSpan(width),
        required: Boolean(options.required),
        readOnly: Boolean(options.readOnly),
        helpText: helpText(options.help),
        viewLabel: fieldViewLabel(field),
        valuePreview: stringifyPreview(entryData[key])
      })
    }
    if (sectionFields.length === 0) continue
    result.push({
      id: `section-${result.length + 1}`,
      fields: sectionFields
    })
  }
  return result
}

export function EntryEditor({
  graph,
  config,
  workspace,
  root,
  entry,
  locale
}: EntryEditorProps) {
  const [state, setState] = useState<EntryEditorState>({
    isLoading: false,
    entry: null
  })

  useEffect(
    function loadSelectedEntry() {
      let isCancelled = false
      if (!workspace || !root || !entry) {
        setState({isLoading: false, entry: null})
        return
      }
      setState({isLoading: true, entry: null})
      async function run() {
        try {
          const currentEntry = await queryEntryByRoute(
            graph,
            workspace,
            root,
            entry,
            locale
          )
          if (isCancelled) return
          setState({isLoading: false, entry: currentEntry})
        } catch (error) {
          if (isCancelled) return
          const message =
            error instanceof Error ? error.message : 'Failed to load entry.'
          setState({isLoading: false, entry: null, errorMessage: message})
        }
      }
      void run()
      return function cancel() {
        isCancelled = true
      }
    },
    [entry, graph, locale, root, workspace]
  )

  const entryType = useMemo(() => {
    if (!state.entry) return undefined
    return config.schema[state.entry.type]
  }, [config, state.entry])

  const sections = useMemo(() => {
    if (!state.entry || !entryType) return []
    return buildSections(entryType, state.entry.data)
  }, [entryType, state.entry])

  return (
    <section className={styles.root()}>
      {state.isLoading ? (
        <div className={styles.state()}>
          <ProgressCircle
            aria-label="Loading entry"
            isIndeterminate
          />
        </div>
      ) : state.errorMessage ? (
        <div className={styles.state()}>{state.errorMessage}</div>
      ) : !entry ? (
        <div className={styles.state()}>Select an entry to edit.</div>
      ) : !state.entry ? (
        <div className={styles.state()}>Entry not found.</div>
      ) : !entryType ? (
        <div className={styles.state()}>
          Unknown type <strong>{state.entry.type}</strong>.
        </div>
      ) : (
        <div className={styles.content()}>
          <header className={styles.header()}>
            <div className={styles.titleWrap()}>
              <h2 className={styles.title()}>
                {state.entry.title || '(Untitled)'}
              </h2>
              <p className={styles.path()}>{state.entry.path || '/'}</p>
            </div>
            <div className={styles.meta()}>
              <span className={styles.type()}>{Type.label(entryType)}</span>
              <EntryStatusBadge
                status={state.entry.status}
                isUnpublished={state.entry.status === 'draft' && state.entry.main}
              />
            </div>
          </header>

          <div className={styles.sections()}>
            {sections.length === 0 ? (
              <div className={styles.state()}>
                This type has no visible fields to render.
              </div>
            ) : (
              sections.map((section, index) => (
                <section
                  key={section.id}
                  className={styles.section()}
                >
                  {sections.length > 1 && (
                    <h3 className={styles.sectionTitle()}>
                      Section {index + 1}
                    </h3>
                  )}
                  <div className={styles.grid()}>
                    {section.fields.map(field => (
                      <Elevation
                        key={field.key}
                        className={styles.field()}
                        style={fieldStyle(field)}
                      >
                        <header className={styles.fieldHeader()}>
                          <div className={styles.fieldLabel()}>
                            {field.label}
                          </div>
                          <div className={styles.flags()}>
                            {field.required && (
                              <span className={styles.flag()}>Required</span>
                            )}
                            {field.readOnly && (
                              <span className={styles.flag({muted: true})}>
                                Read only
                              </span>
                            )}
                          </div>
                        </header>
                        <div className={styles.placeholder()}>
                          {field.valuePreview}
                        </div>
                        <footer className={styles.fieldMeta()}>
                          <span>{field.viewLabel}</span>
                          <span>{Math.round(field.width * 100)}%</span>
                        </footer>
                        {field.helpText && (
                          <p className={styles.help()}>{field.helpText}</p>
                        )}
                      </Elevation>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
