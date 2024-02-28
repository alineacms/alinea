// Let's follow GraphQL rules for now
// http://spec.graphql.org/June2018/#sec-Names
const validIdentifier = /^[_A-Za-z][_0-9A-Za-z]*$/
export function isValidIdentifier(identifier: string) {
  return validIdentifier.test(identifier)
}
