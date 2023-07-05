export namespace Label {
  export type Data = {[language: string]: string}
}
export type Label = string /*| {$label: Label.Data}
export function Label(data: Label.Data) {
  return {$label: data}
}*/

export function renderLabel(label: Label): string {
  // Todo: implement for languages
  return String(label)
}
