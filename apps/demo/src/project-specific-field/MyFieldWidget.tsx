export const MyFieldWidget: React.FC<{
  label: string
}> = ({label}) => {
  return (
    <div className="bg-yellow-200">
      <h2>{label}</h2>
      <p>My Custom Widget</p>
    </div>
  )
}
