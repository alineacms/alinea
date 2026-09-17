import {Config} from 'alinea'
import {createCMS} from 'alinea/next'
import type {SVGProps} from 'react'
import {LandingPage} from '@/entries/landing/LandingPage.schema'
import {SiteLayout} from '@/entries/settings/SiteLayout.schema'

export const cms = createCMS({
  schema: {
    LandingPage,
    SiteLayout
  },
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public',
      roots: {
        pages: Config.root('Pages', {
          contains: ['LandingPage'],
          children: {
            index: Config.page({
              type: LandingPage,
              fields: {
                title: 'Welcome',
                path: ''
              }
            })
          }
        }),
        settings: Config.root('Settings', {
          icon: MaterialSymbolsSettingsOutline,
          contains: ['SiteLayout'],
          children: {
            settings: Config.page({
              type: SiteLayout,
              fields: {
                title: 'Global settings',
                path: 'settings',
                headerText: 'My website',
                footerText: 'Copyright 2026'
              }
            })
          }
        }),
        media: Config.media()
      }
    })
  },
  baseUrl: {
    development: 'http://localhost:3103'
  },
  handlerUrl: '/api/cms',
  dashboardFile: 'admin.html',
  preview: true
})

// Probably best to place this in a separate file, but for the sake of simplicity we'll keep it here
export function MaterialSymbolsSettingsOutline(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      {/* Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE */}
      <path
        fill="currentColor"
        d="m9.25 22l-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75l2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75l2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25l2.75 4.75l-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95l-2.75 4.75l-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2zM11 20h1.975l.35-2.65q.775-.2 1.438-.587t1.212-.938l2.475 1.025l.975-1.7l-2.15-1.625q.125-.35.175-.737T17.5 12t-.05-.787t-.175-.738l2.15-1.625l-.975-1.7l-2.475 1.05q-.55-.575-1.212-.962t-1.438-.588L13 4h-1.975l-.35 2.65q-.775.2-1.437.588t-1.213.937L5.55 7.15l-.975 1.7l2.15 1.6q-.125.375-.175.75t-.05.8q0 .4.05.775t.175.75l-2.15 1.625l.975 1.7l2.475-1.05q.55.575 1.213.963t1.437.587zm1.05-4.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5M12 12"
      />
    </svg>
  )
}
