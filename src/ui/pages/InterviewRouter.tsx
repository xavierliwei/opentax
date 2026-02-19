import { useLocation, Navigate } from 'react-router-dom'
import { STEPS } from '../../interview/steps.ts'

export function InterviewRouter() {
  const location = useLocation()
  const step = STEPS.find((s) => s.path === location.pathname)

  if (!step) {
    return <Navigate to="/" replace />
  }

  const Component = step.component
  return <Component />
}
