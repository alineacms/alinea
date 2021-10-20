import {createContext, useContext} from 'react'

export type ColorScheme = 'light' | 'dark' | undefined

export type ColorSchemeContext = [ColorScheme, () => void]

const context = createContext<ColorSchemeContext | undefined>(undefined)

export function useColorScheme() {
  return useContext(context)!
}

export const ColorSchemeProvider = context.Provider
