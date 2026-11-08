import { ShieldAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'

/** Root `errorElement`: render errors and unmatched routes land here instead of a blank page. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const title = notFound
    ? 'That page does not exist'
    : isRouteErrorResponse(error)
      ? `Error ${error.status}`
      : 'Something went wrong'
  const body = notFound
    ? 'The link may be old or mistyped.'
    : isRouteErrorResponse(error)
      ? error.statusText
      : error instanceof Error
        ? error.message
        : 'An unexpected error interrupted this page.'
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <EmptyState
        icon={ShieldAlert}
        tone={notFound ? 'neutral' : 'danger'}
        title={title}
        body={body}
        action={
          <div className="flex gap-2">
            {notFound ? null : (
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload
              </Button>
            )}
            <a href="/">
              <Button variant={notFound ? 'secondary' : 'ghost'}>Home</Button>
            </a>
          </div>
        }
      />
    </div>
  )
}
