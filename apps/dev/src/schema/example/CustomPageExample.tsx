import {Config} from 'alinea'

export const CustomPage = Config.document('Custom page', {
  view() {
    return (
      <div style={{width: '100%', height: '100%', background: 'red'}}>
        Custom entry view
      </div>
    )
  },
  fields: {}
})
