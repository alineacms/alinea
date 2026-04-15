import {type PropsWithChildren, createContext, useContext} from 'react'

type Parent = 'sink' | 'lift'
interface Elevation {
  level: number
  parent?: Parent
}

const elevation = createContext<Elevation>({
  level: 0
})

export const useElevation = () => useContext(elevation)

export interface ElevationProviderProps {
  type: Parent
}

export function ElevationProvider({
  children,
  type
}: PropsWithChildren<ElevationProviderProps>) {
  const {level} = useElevation()
  return (
    <elevation.Provider value={{level: level + 1, parent: type}}>
      {children}
    </elevation.Provider>
  )
}
