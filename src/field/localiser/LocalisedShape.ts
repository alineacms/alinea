import type {LinkResolver} from '#/core/db/LinkResolver.js'
import type {Shape} from '#/core/Shape.js'
import * as Y from 'yjs'

export type LocalisedValue<Locale extends string, Value> = {
  [Key in Locale]: Value
}

export class LocalisedShape<Locale extends string, Value>
  implements
    Shape<
      LocalisedValue<Locale, Value>,
      (value: LocalisedValue<Locale, Value>) => void
    >
{
  initialValue: LocalisedValue<Locale, Value>

  constructor(
    public label: string,
    public locales: ReadonlyArray<Locale>,
    public shape: Shape<Value>
  ) {
    this.initialValue = this.create()
  }

  create(): LocalisedValue<Locale, Value> {
    return Object.fromEntries(
      this.locales.map(locale => [locale, this.shape.create()])
    ) as LocalisedValue<Locale, Value>
  }

  toY(value: LocalisedValue<Locale, Value>) {
    const map = new Y.Map()
    const record = value ?? this.create()
    for (const locale of this.locales) {
      map.set(locale, this.shape.toY(record[locale]))
    }
    return map
  }

  fromY(map: Y.Map<unknown>): LocalisedValue<Locale, Value> {
    const result: Partial<LocalisedValue<Locale, Value>> = {}
    for (const locale of this.locales) {
      result[locale] = this.shape.fromY(map?.get(locale))
    }
    return result as LocalisedValue<Locale, Value>
  }

  applyY(
    value: LocalisedValue<Locale, Value>,
    parent: Y.Map<unknown>,
    key: string
  ): void {
    const current = parent.get(key)
    if (!(current instanceof Y.Map)) {
      parent.set(key, this.toY(value))
      return
    }
    const record = value ?? this.create()
    for (const locale of this.locales) {
      this.shape.init(current, locale)
      this.shape.applyY(record[locale], current, locale)
    }
  }

  init(parent: Y.Map<unknown>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }

  watch(parent: Y.Map<unknown>, key: string) {
    return (fun: () => void) => {
      const map = parent.get(key)
      if (!(map instanceof Y.Map)) return () => undefined
      map.observe(fun)
      return () => map.unobserve(fun)
    }
  }

  mutator(parent: Y.Map<unknown>, key: string) {
    return (value: LocalisedValue<Locale, Value>) => {
      this.applyY(value, parent, key)
    }
  }

  async applyLinks(value: LocalisedValue<Locale, Value>, loader: LinkResolver) {
    await Promise.all(
      localisedValues(value ?? this.create()).map(localisedValue => {
        return this.shape.applyLinks(localisedValue, loader)
      })
    )
  }

  toV1(value: unknown): LocalisedValue<Locale, Value> {
    const record = isRecord(value) ? value : {}
    const result: Partial<LocalisedValue<Locale, Value>> = {}
    for (const locale of this.locales) {
      result[locale] = this.shape.toV1(record[locale])
    }
    return result as LocalisedValue<Locale, Value>
  }

  searchableText(value: LocalisedValue<Locale, Value>): string {
    return localisedValues(value ?? this.create())
      .map(localisedValue => this.shape.searchableText(localisedValue))
      .join('')
  }
}

function localisedValues<Locale extends string, Value>(
  value: LocalisedValue<Locale, Value>
): Array<Value> {
  return Object.values(value) as Array<Value>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
