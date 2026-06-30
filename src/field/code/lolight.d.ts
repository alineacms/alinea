declare module 'lolight' {
  export interface Lolight {
    (selector?: string): void
    el(element: HTMLElement): void
    tok(text: string): Array<[string, string]>
  }

  const lolight: Lolight
  export default lolight
}
