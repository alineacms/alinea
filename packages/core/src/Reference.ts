export type Reference = Reference.Entry | Reference.Url

export namespace Reference {
  export type Entry = {id: string; type: 'entry'; entry: string}
  export type Url = {id: string; type: 'url'; url: string}
}
