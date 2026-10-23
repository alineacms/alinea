import {
  Button,
  DatePicker,
  MultipleSelect,
  MultipleSelectItem,
  NumberField,
  Select,
  SelectItem,
  Text,
  TextField,
  ToggleGroup,
  ToggleGroupItem
} from '#/components.js'
import type {ScalarField} from '#/core/field/ScalarField.js'
import {createId} from '#/core/Id.js'
import {useEditor, useField, useFieldOptions} from '#/dashboard/hooks.js'
import {IcRoundAdd, IcRoundDelete} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw} from 'jotai'
import {useContext, useMemo} from 'react'
import {choices} from './FormChoices.js'
import css from './FormCondition.module.css'
import {
  type FormCondition,
  type FormOperator,
  type FormRule,
  needsValue,
  operators
} from './FormConditions.js'
import type {FormConditionOptions} from './FormField.js'
import {FormBuilderContext} from './FormField.view.js'
import {Input} from './FormInput.js'
import {type FormEntry, entryLabel, ruleProblem} from './FormRules.js'

const styles = styler(css)

const empty = atom<Array<FormEntry>>([])

export interface FormConditionViewProps {
  field: ScalarField<FormCondition | null, FormConditionOptions>
}

/** Edits when an input is shown or disabled, from the inputs above it */
export function FormConditionView({field}: FormConditionViewProps) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const builder = useContext(FormBuilderContext)
  const editor = useEditor()
  const id = useAtomValueRaw(editor.node.field('_id')) as string
  const order = useAtomValueRaw(builder?.order ?? empty)
  const byId = useMemo(
    () => new Map(order.map(entry => [entry.row._id, entry])),
    [order]
  )
  const self = byId.get(id)
  // Rules follow the reading order, so they can not depend on each other
  const above = useMemo(
    () =>
      self
        ? order.filter(
            entry =>
              entry.index < self.index && entry.input.control !== 'section'
          )
        : [],
    [order, self]
  )
  const readOnly = Boolean(options.readOnly)
  const show = options.effect === 'show'
  const condition = value ?? undefined
  const subject = self?.input.control === 'section' ? 'section' : 'input'

  function update(next: Partial<FormCondition>) {
    if (!condition) return
    setValue({...condition, ...next})
  }

  function ruleFor(target: FormEntry): FormRule {
    const [op] = Object.keys(operators[Input.kind(target.input)])
    return {id: createId(), input: target.row._id, op: op as FormOperator}
  }

  function start() {
    const target = above.at(-1)
    if (!target) return
    setValue({match: 'all', rules: [ruleFor(target)]})
  }

  return (
    <div className={styles.FormCondition()}>
      <div className={styles.FormCondition.header()}>
        <Text weight="medium">{options.label}</Text>
        <ToggleGroup
          type="single"
          size="sm"
          aria-label={options.label}
          disabled={readOnly}
          value={condition ? 'when' : 'never'}
          onValueChange={next => {
            if (next === 'when' && !condition) start()
            if (next === 'never') setValue(null)
          }}
        >
          <ToggleGroupItem value="never">
            {show ? 'Always' : 'Never'}
          </ToggleGroupItem>
          <ToggleGroupItem value="when" disabled={above.length === 0}>
            When…
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {condition && self && (
        <div className={styles.FormCondition.rules()}>
          <div className={styles.FormCondition.match()}>
            <Text size="sm">Match</Text>
            <ToggleGroup
              type="single"
              size="sm"
              aria-label="Match"
              disabled={readOnly}
              value={condition.match}
              onValueChange={match => {
                if (match === 'all' || match === 'any') update({match})
              }}
            >
              <ToggleGroupItem value="all">all</ToggleGroupItem>
              <ToggleGroupItem value="any">any</ToggleGroupItem>
            </ToggleGroup>
            <Text size="sm">of these rules</Text>
          </div>
          {condition.rules.map((rule, index) => (
            <FormRuleEditor
              key={rule.id}
              index={index}
              rule={rule}
              above={above}
              byId={byId}
              self={self}
              readOnly={readOnly}
              onChange={next =>
                update({
                  rules: condition.rules.map(current =>
                    current.id === rule.id ? next : current
                  )
                })
              }
              onTarget={target =>
                update({
                  rules: condition.rules.map(current =>
                    current.id === rule.id ? ruleFor(target) : current
                  )
                })
              }
              onRemove={() => {
                const rules = condition.rules.filter(
                  current => current.id !== rule.id
                )
                setValue(rules.length > 0 ? {...condition, rules} : null)
              }}
            />
          ))}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              icon={IcRoundAdd}
              className={styles.FormCondition.add()}
              onClick={() => {
                const target = above.at(-1)
                if (target)
                  update({rules: [...condition.rules, ruleFor(target)]})
              }}
            >
              Add rule
            </Button>
          )}
        </div>
      )}
      <Text size="sm" color="muted">
        {above.length === 0
          ? `Rules use the inputs above this ${subject}, there are none yet.`
          : `Rules can use the inputs above this ${subject}.`}
      </Text>
    </div>
  )
}

interface FormRuleEditorProps {
  index: number
  rule: FormRule
  above: Array<FormEntry>
  byId: Map<string, FormEntry>
  self: FormEntry
  readOnly: boolean
  onChange: (rule: FormRule) => void
  onTarget: (target: FormEntry) => void
  onRemove: () => void
}

function FormRuleEditor({
  index,
  rule,
  above,
  byId,
  self,
  readOnly,
  onChange,
  onTarget,
  onRemove
}: FormRuleEditorProps) {
  const name = `rule ${index + 1}`
  const target = byId.get(rule.input)
  const kind = target ? Input.kind(target.input) : undefined
  const problem = ruleProblem(rule, self, byId)
  return (
    <div
      className={styles.FormRuleEditor()}
      data-invalid={problem ? '' : undefined}
    >
      <Select
        aria-label={`Input of ${name}`}
        size="sm"
        readOnly={readOnly}
        placeholder="Removed input"
        value={target ? rule.input : null}
        onValueChange={next => {
          const entry = next === null ? undefined : byId.get(String(next))
          if (entry && entry.row._id !== rule.input) onTarget(entry)
        }}
      >
        {above.map(entry => (
          <SelectItem key={entry.row._id} value={entry.row._id}>
            {entryLabel(entry)}
          </SelectItem>
        ))}
      </Select>
      {kind && (
        <Select
          aria-label={`Operator of ${name}`}
          size="sm"
          readOnly={readOnly}
          value={rule.op}
          onValueChange={op => {
            if (!op) return
            const next: FormRule = {...rule, op: op as FormOperator}
            if (!needsValue(next.op)) delete next.value
            onChange(next)
          }}
        >
          {Object.entries(operators[kind]).map(([op, label]) => (
            <SelectItem key={op} value={op}>
              {label}
            </SelectItem>
          ))}
        </Select>
      )}
      {target && kind && needsValue(rule.op) && (
        <FormRuleValue
          name={name}
          rule={rule}
          target={target}
          kind={kind}
          readOnly={readOnly}
          onChange={value => onChange({...rule, value})}
        />
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon-sm"
          icon={IcRoundDelete}
          aria-label={`Remove ${name}`}
          className={styles.FormRuleEditor.remove()}
          onClick={onRemove}
        />
      )}
      {problem && (
        <Text
          size="sm"
          color="destructive"
          className={styles.FormRuleEditor.problem()}
        >
          {problem}
        </Text>
      )}
    </div>
  )
}

interface FormRuleValueProps {
  name: string
  rule: FormRule
  target: FormEntry
  kind: ReturnType<typeof Input.kind>
  readOnly: boolean
  onChange: (value: FormRule['value']) => void
}

function FormRuleValue({
  name,
  rule,
  target,
  kind,
  readOnly,
  onChange
}: FormRuleValueProps) {
  const label = `Value of ${name}`
  const className = styles.FormRuleEditor.value()
  if (kind === 'choice' || kind === 'choices')
    return (
      <MultipleSelect
        aria-label={label}
        className={className}
        readOnly={readOnly}
        placeholder="Choose options"
        value={Array.isArray(rule.value) ? rule.value : []}
        onValueChange={value => onChange(value.map(String))}
      >
        {choices(target.row.options).map(choice => (
          <MultipleSelectItem key={choice.id} value={choice.id}>
            {choice.label}
          </MultipleSelectItem>
        ))}
      </MultipleSelect>
    )
  if (kind === 'number')
    return (
      <NumberField
        aria-label={label}
        className={className}
        readOnly={readOnly}
        value={typeof rule.value === 'number' ? rule.value : null}
        onValueChange={value => onChange(value ?? undefined)}
      />
    )
  if (kind === 'date')
    return (
      <DatePicker
        aria-label={label}
        className={className}
        readOnly={readOnly}
        value={typeof rule.value === 'string' ? rule.value : null}
        onValueChange={value => onChange(value ?? undefined)}
      />
    )
  return (
    <TextField
      aria-label={label}
      className={className}
      readOnly={readOnly}
      value={typeof rule.value === 'string' ? rule.value : ''}
      onValueChange={value => onChange(value)}
    />
  )
}
