import { useLocation, useNavigate } from 'react-router-dom'
import { useTaxStore } from '../store/taxStore.ts'
import { STEPS } from './steps.ts'

export function useInterview() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const location = useLocation()
  const navigate = useNavigate()

  const visibleSteps = STEPS.filter((s) => s.isVisible(taxReturn))
  const currentIndex = visibleSteps.findIndex(
    (s) => s.path === location.pathname,
  )

  const progress = {
    current: currentIndex + 1,
    total: visibleSteps.length,
    percent:
      visibleSteps.length > 0
        ? Math.round(((currentIndex + 1) / visibleSteps.length) * 100)
        : 0,
    completedCount: visibleSteps.filter((s) => s.isComplete(taxReturn)).length,
  }

  return {
    steps: visibleSteps,
    currentStep: visibleSteps[currentIndex] as (typeof visibleSteps)[number] | undefined,
    currentIndex,
    progress,

    goNext: () => {
      if (currentIndex < visibleSteps.length - 1) {
        navigate(visibleSteps[currentIndex + 1].path)
      }
    },
    goPrev: () => {
      if (currentIndex > 0) {
        navigate(visibleSteps[currentIndex - 1].path)
      }
    },
    goToStep: (stepId: string) => {
      const step = visibleSteps.find((s) => s.id === stepId)
      if (step) navigate(step.path)
    },
    canGoNext: currentIndex < visibleSteps.length - 1,
    canGoPrev: currentIndex > 0,
  }
}
