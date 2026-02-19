import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { SSNInput } from '../components/SSNInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Dependent } from '../../model/types.ts'

const RELATIONSHIPS = [
  'son',
  'daughter',
  'stepchild',
  'foster child',
  'sibling',
  'parent',
  'grandchild',
  'other',
]

function emptyDependent(): Dependent {
  return {
    firstName: '',
    lastName: '',
    ssn: '',
    relationship: '',
    monthsLived: 12,
  }
}

export function DependentsPage() {
  const dependents = useTaxStore((s) => s.taxReturn.dependents)
  const addDependent = useTaxStore((s) => s.addDependent)
  const updateDependent = useTaxStore((s) => s.updateDependent)
  const removeDependent = useTaxStore((s) => s.removeDependent)
  const interview = useInterview()

  return (
    <div data-testid="page-dependents" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Dependents</h1>
      <p className="mt-1 text-sm text-gray-600">
        Add any dependents you're claiming on your return. You can skip this if you have none.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="Dependents"
          items={dependents}
          addLabel="Add Dependent"
          emptyMessage="No dependents added. Click '+ Add Dependent' if you have any."
          onAdd={() => addDependent(emptyDependent())}
          onRemove={(index) => removeDependent(index)}
          renderItem={(dep, index) => (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">First name</label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                    value={dep.firstName}
                    onChange={(e) =>
                      updateDependent(index, { firstName: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Last name</label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                    value={dep.lastName}
                    onChange={(e) =>
                      updateDependent(index, { lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SSNInput
                  label="SSN"
                  value={dep.ssn}
                  onChange={(ssn) => updateDependent(index, { ssn })}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Relationship</label>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                    value={dep.relationship}
                    onChange={(e) =>
                      updateDependent(index, { relationship: e.target.value })
                    }
                  >
                    <option value="">Select</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Months lived with you</label>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                    value={dep.monthsLived}
                    onChange={(e) =>
                      updateDependent(index, { monthsLived: Number(e.target.value) })
                    }
                  >
                    {Array.from({ length: 13 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
