export class IndexEvent extends Event {
  static readonly INDEX = 'index'
  static readonly ENTRY = 'entry'
  constructor(
    type: 'index' | 'entry',
    public readonly subject: string
  ) {
    super(type)
  }
}
