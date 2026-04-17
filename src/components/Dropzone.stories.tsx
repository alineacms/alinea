import type {DropEvent} from '@react-types/shared'
import {useState} from 'react'
import {FileTrigger, Text} from 'react-aria-components'
import {isFileDropItem} from 'react-aria-components'
import {Button} from './Button.tsx'
import {DropZone} from './DropZone.tsx'

export const image = () => {
  const [droppedImage, setDroppedImage] = useState<string | undefined>(
    undefined
  )

  const onDropHandler = async (e: DropEvent) => {
    const item = e.items
      .filter(isFileDropItem)
      .find(item => item.type === 'image/jpeg' || item.type === 'image/png')
    if (item) {
      const file = await item.getFile()
      setDroppedImage(URL.createObjectURL(file))
    }
  }

  const onSelectHandler = async (e: any) => {
    if (e) {
      const files = Array.from([...e])
      const item = files[0]

      if (item) {
        setDroppedImage(URL.createObjectURL(item))
      }
    }
  }

  return (
    <DropZone
      getDropOperation={types =>
        types.has('image/jpeg') || types.has('image/png') ? 'copy' : 'cancel'
      }
      onDrop={onDropHandler}
    >
      {droppedImage ? (
        <img
          alt=""
          src={droppedImage}
          style={{
            display: 'block',
            height: 'auto',
            maxWidth: '100%',
            objectFit: 'contain'
          }}
        />
      ) : (
        <>
          <FileTrigger
            acceptedFileTypes={['image/png', 'image/jpeg']}
            allowsMultiple={false}
            onSelect={onSelectHandler}
          >
            <Button>Upload a image</Button>
          </FileTrigger>
          <Text slot="description">Or drag and drop a image here.</Text>
        </>
      )}
    </DropZone>
  )
}

export const file = () => {
  const [droppedFile, setDroppedFile] = useState<string | undefined>(undefined)

  const onDropHandler = async (e: DropEvent) => {
    const item = e.items
      .filter(isFileDropItem)
      .find(item => item.type === 'application/pdf')
    if (item) {
      const file = await item.getFile()
      setDroppedFile(URL.createObjectURL(file))
    }
  }

  const onSelectHandler = async (e: any) => {
    if (e) {
      const files = Array.from([...e])
      const item = files[0]

      if (item) {
        setDroppedFile(URL.createObjectURL(item))
      }
    }
  }

  return (
    <DropZone
      getDropOperation={types =>
        types.has('application/pdf') ? 'copy' : 'cancel'
      }
      onDrop={onDropHandler}
    >
      {droppedFile ? (
        <p>Dropped file: {droppedFile}</p>
      ) : (
        <>
          <FileTrigger
            acceptedFileTypes={['application/pdf']}
            allowsMultiple={false}
            onSelect={onSelectHandler}
          >
            <Button>Upload a file</Button>
          </FileTrigger>
          <Text slot="description">Or drag and drop a file here.</Text>
        </>
      )}
    </DropZone>
  )
}

export default {
  title: 'Components / Dropzone'
}
