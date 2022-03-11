import {encode} from 'base64-arraybuffer'

export function btoa(input: string) {
  var buf = new ArrayBuffer(input.length * 2)
  var bufView = new Uint16Array(buf)
  for (var i = 0, strLen = input.length; i < strLen; i++) {
    bufView[i] = input.charCodeAt(i)
  }
  return encode(buf)
}
