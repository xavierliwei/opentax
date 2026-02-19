interface DocumentCardProps {
  title: string
  subtitle?: string
  onEdit: () => void
  onRemove: () => void
  confidence?: number // 0–1
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    confidence >= 0.9
      ? 'text-green-600'
      : confidence >= 0.7
        ? 'text-yellow-600'
        : 'text-red-600'

  return (
    <span className={`text-xs ${color}`} title={`OCR confidence: ${pct}%`}>
      {pct}% confidence
    </span>
  )
}

export function DocumentCard({
  title,
  subtitle,
  onEdit,
  onRemove,
  confidence,
}: DocumentCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
        {confidence !== undefined && confidence < 1 && (
          <ConfidenceIndicator confidence={confidence} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-tax-blue hover:text-blue-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
