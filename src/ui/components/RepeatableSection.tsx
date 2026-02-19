import type { ReactNode } from 'react'

const ACCENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6']

interface RepeatableSectionProps<T> {
  label: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  onAdd: () => void
  onRemove: (index: number) => void
  addLabel?: string
  maxItems?: number
  emptyMessage?: string
}

export function RepeatableSection<T>({
  label,
  items,
  renderItem,
  onAdd,
  onRemove,
  addLabel = 'Add',
  maxItems,
  emptyMessage = 'No items added yet.',
}: RepeatableSectionProps<T>) {
  const addDisabled = maxItems !== undefined && items.length >= maxItems

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          className="text-sm text-tax-blue hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          + {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={index} className="relative border border-gray-200 border-l-4 rounded-md p-3" style={{ borderLeftColor: ACCENT_COLORS[index % ACCENT_COLORS.length] }}>
              <div>{renderItem(item, index)}</div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 text-xs text-red-400 hover:text-red-600"
                aria-label={`Remove item ${index + 1}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
