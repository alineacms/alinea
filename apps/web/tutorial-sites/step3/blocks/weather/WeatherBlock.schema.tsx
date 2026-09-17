import {Config, Field} from 'alinea'

export const WeatherBlock = Config.type('Weather block', {
  fields: {
    title: Field.text('Title', {required: true, width: 0.5}),
    region: Field.text('Region', {
      required: true,
      width: 0.5,
      help: 'City or region name, for example: Brussels or New York'
    })
  }
})
