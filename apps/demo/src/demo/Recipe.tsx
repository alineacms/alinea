export interface RecipeProps {
  title: string
}

export function Recipe({title}: RecipeProps) {
  return (
    <main>
      <h1>{title}</h1>
    </main>
  )
}
