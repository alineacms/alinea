const forms = new WeakSet<object>()

/** Marks a field made with `Field.form`, which config checks for */
export function markForm<F extends object>(field: F): F {
  forms.add(field)
  return field
}

/**
 * Whether a field was made with `Field.form`. Config checks the fields of
 * types with it, without loading the form builder.
 */
export function isForm(field: object): boolean {
  return forms.has(field)
}
