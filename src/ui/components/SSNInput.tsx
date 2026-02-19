import { useState, useCallback } from 'react'

interface SSNInputProps {
  label: string
  value: string // 9 digits, no dashes
  onChange: (ssn: string) => void
  masked?: boolean
}

function formatWithDashes(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`
}

function maskSSN(digits: string): string {
  if (digits.length < 6) return formatWithDashes(digits)
  return `•••-••-${digits.slice(5, 9)}`
}

export function SSNInput({
  label,
  value,
  onChange,
  masked = true,
}: SSNInputProps) {
  const [focused, setFocused] = useState(false)

  const handleFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setFocused(false)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
      onChange(digits)
    },
    [onChange],
  )

  let displayValue: string
  if (focused) {
    displayValue = formatWithDashes(value)
  } else if (masked && value.length > 0) {
    displayValue = maskSSN(value)
  } else {
    displayValue = formatWithDashes(value)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        className="border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="XXX-XX-XXXX"
        maxLength={11}
        autoComplete="off"
      />
    </div>
  )
}
