import {Entry, Field, isSeparator, slugify} from 'alinea/core'
import {pathSuffix} from 'alinea/core/EntryFilenames'
import {useEntryEditor} from 'alinea/dashboard/hook/UseEntryEditor'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {InputLabel, InputState, useInput} from 'alinea/editor'
import {fromModule, px} from 'alinea/ui'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {useRef, useState} from 'react'
import {useQuery} from 'react-query'
import {PathField, path as createPath} from './PathField.js'
import css from './PathInput.module.scss'
export * from './PathField.js'

export const path = Field.provideView(PathInput, createPath)

const styles = fromModule(css)
const INPUT_OFFSET_LEFT = 16
const INPUT_OFFSET_RIGHT = 26

type PathInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: PathField
}

function PathInput({state, field}: PathInputProps) {
  const graph = useGraph()
  const editor = useEntryEditor()
  const {label, options} = field[Field.Data]
  const {width, from = 'title', help, optional} = options
  const [focus, setFocus] = useState(false)
  const hiddenRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suffixRef = useRef<HTMLDivElement>(null)
  const parentState = state.parent()
  if (!parentState) throw new Error('Path field needs parent state')
  const [source = ''] = useInput<InputState.Scalar<string>>(
    parentState.child(from)
  )
  const [value = slugify(source), setValue] =
    useInput<InputState.Scalar<string>>(state)
  const [endsWithSeparator, setEndsWithSeparator] = useState(false)
  const inputValue = (value || '') + (endsWithSeparator ? '-' : '')
  const empty = value === ''

  async function getConflictingPaths() {
    if (!editor) return []
    const sameLocation = Entry.root
      .is(editor.activeVersion.root)
      .and(
        Entry.workspace.is(editor.activeVersion.workspace),
        Entry.locale.is(editor.activeVersion.locale)
      )
    const sameParent = Entry.parent.is(editor.activeVersion.parent ?? null)
    const isExact = Entry.path.is(inputValue)
    const startsWith = Entry.path.like(inputValue + '-%')
    const isNotSelf = editor.entryId
      ? Entry.entryId.isNot(editor.entryId)
      : true
    const condition = sameLocation.and(
      sameParent,
      isNotSelf,
      isExact.or(startsWith)
    )
    return graph.preferPublished.find(
      Entry().where(condition).select(Entry.path)
    )
  }

  const {data: conflictingPaths} = useQuery(
    ['path', editor?.entryId, editor?.activeVersion.parent, inputValue],
    getConflictingPaths
  )

  async function applySuffix() {
    const pathData = await getConflictingPaths()
    const suffix = pathSuffix(inputValue, pathData)
    if (!suffix) return
    setValue(slugify(`${inputValue}-${suffix}`))
  }

  const currentSuffix =
    conflictingPaths && pathSuffix(inputValue, conflictingPaths)

  function getSuffixPosition(): number {
    if (!currentSuffix) return 0
    if (!hiddenRef.current || !inputRef.current || !suffixRef.current) return 0
    // Check if text overflows input field width
    if (
      hiddenRef.current.clientWidth +
        INPUT_OFFSET_LEFT +
        getRightInputPadding() >=
      inputRef.current.clientWidth
    )
      return inputRef.current.clientWidth - getRightInputPadding()
    return hiddenRef.current.clientWidth + INPUT_OFFSET_LEFT
  }

  function getRightInputPadding(): number {
    if (!currentSuffix) return INPUT_OFFSET_RIGHT
    if (!suffixRef.current) return INPUT_OFFSET_RIGHT
    if (suffixRef.current.clientWidth + 10 > INPUT_OFFSET_RIGHT)
      return suffixRef.current.clientWidth + 10
    return INPUT_OFFSET_RIGHT
  }

  return (
    <InputLabel
      asLabel
      label={label}
      help={help}
      optional={optional}
      width={width}
      focused={focus}
      icon={IcRoundLink}
      empty={empty}
    >
      <div className={styles.root.input.container()}>
        <input
          ref={inputRef}
          className={styles.root.input()}
          type="text"
          value={inputValue}
          onChange={e => {
            const value = e.currentTarget.value
            setEndsWithSeparator(isSeparator(value.charAt(value.length - 1)))
            setValue(slugify(value))
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false)
            applySuffix()
          }}
          style={{paddingRight: px(getRightInputPadding())}}
          disabled={options.readOnly}
        />
        <div
          ref={suffixRef}
          className={styles.root.suffix()}
          style={{left: px(getSuffixPosition())}}
        >
          {currentSuffix ? `-${currentSuffix}` : null}
        </div>
      </div>
      <span ref={hiddenRef} className={styles.root.hidden()}>
        {inputValue}
      </span>
    </InputLabel>
  )
}
