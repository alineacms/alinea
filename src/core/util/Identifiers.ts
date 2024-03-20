// Let's follow GraphQL rules for now, with one exception: we don't allow
// a starting underscore to reserve it for internal use.
// http://spec.graphql.org/June2018/#sec-Names
const validIdentifier = /^[A-Za-z][A-Za-z0-9_]*$/
export function isValidIdentifier(identifier: string) {
  return validIdentifier.test(identifier)
}
