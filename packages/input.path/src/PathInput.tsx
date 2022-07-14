import {Entry, isSeparator, Outcome, slugify} from '@alinea/core'
import {useCurrentDraft, useSession} from '@alinea/dashboard'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, px} from '@alinea/ui'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'
import {useRef, useState} from 'react'
import {useQuery} from 'react-query'
import {PathField} from './PathField'
import css from './PathInput.module.scss'

const styles = fromModule(css)
const INPUT_OFFSET_LEFT = 16
const INPUT_OFFSET_RIGHT = 26

export type PathInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: PathField
}

export function PathInput({state, field}: PathInputProps) {
  const {width, from = 'title', help, optional} = field.options
  const [focus, setFocus] = useState(false)
  const hiddenRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suffixRef = useRef<HTMLDivElement>(null)
  const parentState = state.parent()
  if (!parentState) throw 'Parent state not found'
  const [source = ''] = useInput<InputState.Scalar<string>>(
    parentState.child(from)
  )
  const [value = slugify(source), setValue] =
    useInput<InputState.Scalar<string>>(state)
  const [endsWithSeparator, setEndsWithSeparator] = useState(false)
  const inputValue = (value || '') + (endsWithSeparator ? '-' : '')
  const empty = value === ''

  const {hub} = useSession()
  const draft = useCurrentDraft()
  // WIP:
  type Paths = Array<{id: string; path: string}>
  function getPaths() {
    const isParent = Entry.parent.is(draft.parent)
    const isExact = Entry.path.is(inputValue)
    const startsWith = Entry.path.like(inputValue + '-%')
    const isNotSelf = Entry.id.isNot(draft.id)
    const condition = isParent.and(isNotSelf).and(isExact.or(startsWith))
    return hub
      .query({
        cursor: Entry.where(condition).select({id: Entry.id, path: Entry.path})
      })
      .then(Outcome.unpack)
  }
  const {data} = useQuery(
    ['path', draft.parent, draft.id, inputValue],
    getPaths
  )

  function getSuffix(data: Paths) {
    if (!data.length) return
    const otherPaths = data.map(d => d.path)
    if (otherPaths.includes(inputValue)) {
      let suffix = 0
      while (true)
        if (!otherPaths.includes(`${inputValue}-${++suffix}`)) return suffix
    }
  }

  async function applySuffix() {
    const pathData = await getPaths()
    const suffix = getSuffix(pathData)
    if (!suffix) return
    setValue(slugify(`${inputValue}-${suffix}`))
  }

  /* Todo:
      - Server side
      - On create new (path field, via server side)
      - right to left written languages (nice to have)
  */

  const currentSuffix = data && getSuffix(data)

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
      label={field.label}
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
