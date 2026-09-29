import {ImageResponse} from 'next/og'

export const size = {width: 180, height: 180}
export const contentType = 'image/png'

/** The logo mark of icon.svg on a full square, iOS rounds the corners */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#3f61e8'
      }}
    >
      <svg width="180" height="180" viewBox="0 0 192 192">
        <path
          fill="#fff"
          d="M111.03,55.45v7.12c-4.91-5.76-12.19-9.24-22.16-9.24-19.48,0-35.54,17.42-35.54,40s16.06,40,35.54,40c9.96,0,17.25-3.48,22.16-9.24v7.12h22.31V55.45h-22.31ZM93.33,111.82c-10.26,0-17.69-7.12-17.69-18.48s7.43-18.48,17.69-18.48,17.69,7.12,17.69,18.48-7.43,18.48-17.69,18.48Z"
        />
      </svg>
    </div>,
    size
  )
}
