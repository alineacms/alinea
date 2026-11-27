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
import {localeDisplay} from '#/dashboard/app/LocaleMenu.js'
import {
  useEditor,
  useField,
  useFieldOptions,
  useOptionalEntryAtoms
} from '#/dashboard/hooks.js'
import {IcRoundAdd, IcRoundDelete} from '#/dashboard/icons.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
import {choices} from './FormChoices.js'
import css from './FormCondition.module.css'
import {
  type FormCondition,
  type FormOperator,
  type FormRule,
  localeInput,
  localeOperators,
  needsValue,
  operators
} from './FormConditions.js'
import type {FormConditionOptions} from './FormField.js'
import {useFormOrder} from './UseFormOrder.js'
import {Input} from './FormInput.js'
import {type FormEntry, entryLabel, ruleProblem} from './FormRules.js'

const styles = styler(css)

const noLocales = atom(Array<string>())

export interface FormConditionViewProps {
  field: ScalarField<FormCondition | null, FormConditionOptions>
}

/**
 * Edits when an input is shown or disabled, from the inputs above it, or
 * when a mail is sent, from every input of the form. In an i18n root rules
 * can also test the language the form is filled in.
 */
export function FormConditionView({field}: FormConditionViewProps) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const editor = useEditor()
  const id = useAtomValueRaw(editor.node.field('_id')) as string
  const order = useFormOrder()
  const context = useOptionalEntryAtoms()
  const locales = useAtomValueRaw(context?.entry.rootLocales ?? noLocales)
  const byId = useMemo(
    () => new Map(order.map(entry => [entry.row._id, entry])),
    [order]
  )
  const self = byId.get(id)
  // Rules of inputs follow the reading order, so they can not depend on each
  // other, rows outside the form use all of its inputs
  const position = options.effect === 'send' ? Infinity : (self?.index ?? -1)
  // Inputs of a repeatable section can only be used within that section
  const within = options.effect === 'send' ? undefined : self?.repeat
  const above = useMemo(
    () =>
      order.filter(
        entry =>
          entry.index < position &&
          entry.input.control !== 'section' &&
          entry.input.control !== 'content' &&
          (!entry.repeat || entry.repeat === within)
      ),
    [order, position, within]
  )
  const readOnly = Boolean(options.readOnly)
  // Without rules an input is shown, but not disabled or required by them
  const always = options.effect === 'show' || options.effect === 'send'
  const condition = value ?? undefined
  const subject =
    self?.input.control === 'section'
      ? 'section'
      : self?.input.control === 'content'
        ? 'text'
        : 'input'
  // A mail is sent once every answer is in, it is not above or below them
  const scope =
    options.effect === 'send'
      ? 'the inputs of the form outside repeatable sections'
      : `the inputs above this ${subject}`

  function update(next: Partial<FormCondition>) {
    if (!condition) return
    setValue({...condition, ...next})
  }

  // The input a new rule starts with, the language without inputs
  const initial =
    above.at(-1)?.row._id ?? (locales.length > 0 ? localeInput : undefined)

  function ruleFor(input: string): FormRule {
    if (input === localeInput) return {id: createId(), input, op: 'is'}
    const [op] = Object.keys(operators[Input.kind(byId.get(input)!.input)])
    return {id: createId(), input, op: op as FormOperator}
  }

  function start() {
    if (initial) setValue({match: 'all', rules: [ruleFor(initial)]})
  }

  return (
    <div className={styles.FormCondition()}>
      <div className={styles.FormCondition.header()}>
        <Text weight="medium">{options.label}</Text>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          aria-label={options.label}
          disabled={readOnly}
          value={condition ? 'when' : 'never'}
          onValueChange={next => {
            if (next === 'when' && !condition) start()
            if (next === 'never') setValue(null)
          }}
        >
          <ToggleGroupItem value="never">
            {always ? 'Always' : 'Never'}
          </ToggleGroupItem>
          <ToggleGroupItem value="when" disabled={!initial}>
            When…
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {condition && position >= 0 && (
        <div className={styles.FormCondition.rules()}>
          <div className={styles.FormCondition.match()}>
            <Text size="sm">Match</Text>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
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
              locales={locales}
              byId={byId}
              position={position}
              within={within}
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
                if (initial)
                  update({rules: [...condition.rules, ruleFor(initial)]})
              }}
            >
              Add rule
            </Button>
          )}
        </div>
      )}
      <Text size="sm" color="muted">
        {!initial
          ? `Rules use ${scope}, there are none yet.`
          : locales.length > 0
            ? `Rules can use the language and ${scope}.`
            : `Rules can use ${scope}.`}
      </Text>
    </div>
  )
}

interface FormRuleEditorProps {
  index: number
  rule: FormRule
  above: Array<FormEntry>
  /** The locales a rule on the language can choose from */
  locales: ReadonlyArray<string>
  byId: Map<string, FormEntry>
  /** The position of the input in reading order, see `ruleProblem` */
  position: number
  /** The repeatable section the input is in, see `ruleProblem` */
  within?: string
  readOnly: boolean
  onChange: (rule: FormRule) => void
  /** Points the rule at another input, by the id of its row */
  onTarget: (input: string) => void
  onRemove: () => void
}

function FormRuleEditor({
  index,
  rule,
  above,
  locales,
  byId,
  position,
  within,
  readOnly,
  onChange,
  onTarget,
  onRemove
}: FormRuleEditorProps) {
  const name = `rule ${index + 1}`
  const isLocale = rule.input === localeInput
  const target = byId.get(rule.input)
  const kind = target ? Input.kind(target.input) : undefined
  const ops = isLocale ? localeOperators : kind && operators[kind]
  const problem = ruleProblem(rule, position, byId, within)
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
        value={target || isLocale ? rule.input : null}
        onValueChange={next => {
          if (next !== null && String(next) !== rule.input)
            onTarget(String(next))
        }}
      >
        {(locales.length > 0 || isLocale) && (
          <SelectItem value={localeInput}>Language</SelectItem>
        )}
        {above.map(entry => (
          <SelectItem key={entry.row._id} value={entry.row._id}>
            {entryLabel(entry)}
          </SelectItem>
        ))}
      </Select>
      {ops && (
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
          {Object.entries(ops).map(([op, label]) => (
            <SelectItem key={op} value={op}>
              {label}
            </SelectItem>
          ))}
        </Select>
      )}
      {isLocale && (
        <MultipleSelect
          aria-label={`Value of ${name}`}
          className={styles.FormRuleEditor.value()}
          readOnly={readOnly}
          placeholder="Choose languages"
          value={Array.isArray(rule.value) ? rule.value : []}
          onValueChange={value => onChange({...rule, value: value.map(String)})}
        >
          {locales.map(locale => (
            <MultipleSelectItem key={locale} value={locale}>
              {localeDisplay(locale).name}
            </MultipleSelectItem>
          ))}
        </MultipleSelect>
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
