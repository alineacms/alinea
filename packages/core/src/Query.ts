import {Cursor} from 'helder.store'

type QueryCreator<Vars, T> = (vars: Vars) => Cursor<T>

export function query<Vars, T>(create: QueryCreator<Vars, T>) {
  return (vars: Vars) => {
    return create(vars)
  }
}
