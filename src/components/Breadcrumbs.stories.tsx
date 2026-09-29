import {useState} from 'react'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './Breadcrumbs.js'

export function Example() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#components">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function Navigation() {
  const [path, setPath] = useState(['Pages', 'Blog', 'Article'])
  return (
    <Breadcrumb aria-label="Location">
      <BreadcrumbList>
        {path.map((segment, index) => {
          const last = index === path.length - 1
          return [
            index > 0 && <BreadcrumbSeparator key={`${segment}-separator`} />,
            <BreadcrumbItem key={segment}>
              {last ? (
                <BreadcrumbPage>{segment}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    onClick={() => setPath(path.slice(0, index + 1))}
                  >
                    {segment}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ]
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default {
  title: 'Pure components / Breadcrumbs'
}
