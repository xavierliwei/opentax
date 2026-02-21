import { useNavigate } from 'react-router-dom'

export function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div data-testid="page-welcome" className="max-w-xl mx-auto py-8 sm:py-12 px-4 sm:px-0 text-center">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
        Welcome to OpenTax
      </h1>
      <p className="mt-3 text-base sm:text-lg text-gray-600">
        Free, open-source tax preparation for your 2025 federal return.
        Your data never leaves your browser.
      </p>
      <button
        type="button"
        onClick={() => navigate('/interview/filing-status')}
        className="mt-8 w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-brand text-white font-medium rounded-lg hover:bg-blue-900 active:bg-blue-950 transition-colors"
      >
        Let's Start
      </button>
    </div>
  )
}
