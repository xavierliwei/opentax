import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { SSNInput } from '../components/SSNInput.tsx'
import { DateInput } from '../components/DateInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'

export function SpouseInfoPage() {
  const spouse = useTaxStore((s) => s.taxReturn.spouse)
  const setSpouse = useTaxStore((s) => s.setSpouse)
  const interview = useInterview()

  // Initialize spouse if not yet created
  const firstName = spouse?.firstName ?? ''
  const middleInitial = spouse?.middleInitial ?? ''
  const lastName = spouse?.lastName ?? ''
  const ssn = spouse?.ssn ?? ''
  const dateOfBirth = spouse?.dateOfBirth ?? ''

  return (
    <div data-testid="page-spouse-info" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Spouse Information</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your spouse's details for your joint return.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {/* Name */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">First name</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={firstName}
              onChange={(e) => setSpouse({ firstName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">MI</label>
            <input
              type="text"
              maxLength={1}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-12 text-center focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={middleInitial}
              onChange={(e) => setSpouse({ middleInitial: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Last name</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={lastName}
              onChange={(e) => setSpouse({ lastName: e.target.value })}
            />
          </div>
        </div>

        {/* SSN + DOB */}
        <div className="grid grid-cols-2 gap-3">
          <SSNInput
            label="Social Security Number"
            value={ssn}
            onChange={(val) => setSpouse({ ssn: val })}
          />
          <DateInput
            label="Date of Birth"
            value={dateOfBirth}
            onChange={(val) => setSpouse({ dateOfBirth: val })}
          />
        </div>
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
