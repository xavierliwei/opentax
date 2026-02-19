import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { SSNInput } from '../components/SSNInput.tsx'
import { DateInput } from '../components/DateInput.tsx'
import { StateSelect } from '../components/StateSelect.tsx'
import { InterviewNav } from './InterviewNav.tsx'

export function PersonalInfoPage() {
  const taxpayer = useTaxStore((s) => s.taxReturn.taxpayer)
  const setTaxpayer = useTaxStore((s) => s.setTaxpayer)
  const interview = useInterview()

  return (
    <div data-testid="page-personal-info" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Your Information</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your personal details as they appear on your tax documents.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {/* Name */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">First name</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.firstName}
              onChange={(e) => setTaxpayer({ firstName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">MI</label>
            <input
              type="text"
              maxLength={1}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-12 text-center focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.middleInitial ?? ''}
              onChange={(e) => setTaxpayer({ middleInitial: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Last name</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.lastName}
              onChange={(e) => setTaxpayer({ lastName: e.target.value })}
            />
          </div>
        </div>

        {/* SSN + DOB */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SSNInput
            label="Social Security Number"
            value={taxpayer.ssn}
            onChange={(ssn) => setTaxpayer({ ssn })}
          />
          <DateInput
            label="Date of Birth"
            value={taxpayer.dateOfBirth ?? ''}
            onChange={(dateOfBirth) => setTaxpayer({ dateOfBirth })}
          />
        </div>

        {/* Address */}
        <h2 className="text-sm font-semibold text-gray-800 mt-2">Address</h2>

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Street address</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.address.street}
              onChange={(e) =>
                setTaxpayer({ address: { ...taxpayer.address, street: e.target.value } })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Apt/Suite</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.address.apartment ?? ''}
              onChange={(e) =>
                setTaxpayer({ address: { ...taxpayer.address, apartment: e.target.value } })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr] gap-3">
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className="text-sm font-medium text-gray-700">City</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.address.city}
              onChange={(e) =>
                setTaxpayer({ address: { ...taxpayer.address, city: e.target.value } })
              }
            />
          </div>
          <StateSelect
            label="State"
            value={taxpayer.address.state}
            onChange={(state) =>
              setTaxpayer({ address: { ...taxpayer.address, state } })
            }
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">ZIP code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={taxpayer.address.zip}
              onChange={(e) =>
                setTaxpayer({ address: { ...taxpayer.address, zip: e.target.value } })
              }
            />
          </div>
        </div>
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
