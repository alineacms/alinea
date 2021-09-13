import {css} from '@stitches/react'
import React from 'react'
import {useQuery} from 'react-query'
import {useConfig} from '../App'

const styles = {
  root: css({
    height: '100%',
    width: '250px',
    borderRight: '1px solid #595959',
    background: '#191A1F',
    padding: '10px'
  })
}

export function Sidebar() {
  const {client} = useConfig()
  const {isLoading, error, data} = useQuery('sidebar', () =>
    client.content().list()
  )
  return (
    <div className={styles.root()}>
      {data?.map(entry => {
        return <div key={entry.id}>{entry.id}</div>
      })}
    </div>
  )
}
