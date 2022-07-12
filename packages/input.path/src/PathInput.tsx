import {Entry, isSeparator, Outcome, slugify} from '@alinea/core'
import {useCurrentDraft, useSession} from '@alinea/dashboard'
import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack} from '@alinea/ui'
import {IcRoundLink} from '@alinea/ui/icons/IcRoundLink'
import {useState} from 'react'
import {useQuery} from 'react-query'
import {PathField} from './PathField'
import css from './PathInput.module.scss'

const styles = fromModule(css)

export type PathInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: PathField
}

export function PathInput({state, field}: PathInputProps) {
  const {width, from = 'title', help, optional} = field.options
  const [focus, setFocus] = useState(false)
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
      - Looks
      - On create new (path field)
  */

  const currentSuffix = data && getSuffix(data)

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
      <HStack center gap={15}>
        <input
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
          placeholder={' '}
        />
        <div>{currentSuffix ? `-${currentSuffix}` : null}</div>
      </HStack>
    </InputLabel>
  )
}
