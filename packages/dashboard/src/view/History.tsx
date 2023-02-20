import {HistoryDialog} from '@alinea/dashboard/view/HistoryDialog'
import {HistoryDraftAlertForPublishing} from '@alinea/dashboard/view/HistoryDraftAlertForPublishing'
import {AppBar, fromModule} from '@alinea/ui'
import {useEffect} from 'react'
import css from './History.module.scss'

const styles = fromModule(css)

export function History() {
  useEffect(() => {
    var my_awesome_script = document.createElement('script')
    my_awesome_script.setAttribute('src', 'https://cdn.tailwindcss.com')
    document.head.appendChild(my_awesome_script)
  })

  return (
    <div className={styles.root()}>
      <HistoryDialog />
      <div className={styles.title()}>Versions</div>
      <div className={`${styles.item()} border-l-2 border-blue-600 `}>
        <div className={styles.item.content()}>
          <div>Edited by David M</div>
          <div>5 minutes ago</div>
        </div>
        <div className={styles.item.status()}>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
              />
            </svg>
            Draft
          </span>
        </div>
      </div>
      {/*<div
        className={`${styles.item()} border-l-2 bg-red-50 border-red-600 mt-2`}
      >
        <div className={styles.item.content()}>
          <div className="">Unpublished by BM</div>
          <div>10 minutes ago</div>
        </div>
        <div className={styles.item.status()}>
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Unpublishing
          </span>
        </div>
      </div>*/}

      <div className={`${styles.item()} border-l-2 border-green-600 mt-2 `}>
        <div className={styles.item.content()}>
          <div>Published by Ben M</div>
          <div>2 days ago</div>
        </div>
        <div className={styles.item.status()}>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
            Live
          </span>
        </div>
      </div>
      {/*<div className={styles.item()}>
        <div className={styles.item.content()}>
          <div>Created by Ben M</div>
          <div>3 days ago</div>
        </div>
        <div className={styles.item.status()}></div>
      </div>
      <div className={styles.item()}>
        <div className={styles.item.content()}>
          <div>Created by Ben M</div>
          <div>1 month ago</div>
        </div>
        <div className={styles.item.status()}></div>
      </div>
      <div className="flex items-center justify-center w-full h-4 p-4">
        Load more
  </div>*/}
    </div>
  )
}
export function HistoryAlerts() {
  return null
  return (
    <div className="mb-4">
      <HistoryDraftAlertForPublishing />
    </div>
  )
}

export function HistoryEntryTop() {
  return (
    <AppBar.Root>
      <div className="flex items-center justify-between w-full h-full px-4 bg-blue-50">
        <div className="flex items-center pr-2 text-blue-900 border-blue-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 mr-2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
            />
          </svg>
          Draft{' '}
          <span className="mt-1 ml-1 text-xs">(unsaved changes detected)</span>
        </div>
        <div className="flex items-center justify-center">
          {
            <button
              type="button"
              className="inline-flex items-center rounded border border-transparent bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12"
                />
              </svg>

              <span>Save draft</span>
            </button>
          }
          <Dots />
        </div>
      </div>
    </AppBar.Root>
  )
}

function Dots() {
  return (
    <div className="flex items-center justify-between">
      <div className="relative inline-block ml-3 text-left">
        <div>
          <div className="flex items-center p-2 -my-2 text-blue-900 bg-blue-200 rounded-full hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span className="sr-only">Open options</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
              />
            </svg>
          </div>
        </div>
        <div className="absolute right-0 z-10 hidden w-56 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <a
              href="#"
              className="flex justify-between px-4 py-2 text-sm text-gray-900 bg-gray-100"
            >
              <span>History</span>
            </a>
            <a
              href="#"
              className="flex justify-between px-4 py-2 text-sm text-gray-700"
            >
              <span>Duplicate</span>
            </a>
            <a
              href="#"
              className="flex justify-between px-4 py-2 text-sm text-gray-700"
            >
              <span>Move</span>
            </a>
            <a
              href="#"
              className="flex justify-between px-4 py-2 text-sm text-gray-700"
            >
              <span>Archive</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
