import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { cents, dollars } from '../../model/traced.ts'

interface CurrencyInputProps {
  label: ReactNode
  value: number // integer cents
  onChange: (cents: number) => void
  placeholder?: string
  required?: boolean
  helperText?: string
}

function formatDisplay(valueInCents: number): string {
  const d = dollars(valueInCents)
  return d.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function parseToCents(raw: string): number {
  // Strip everything except digits and decimal point
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return 0
  return cents(parsed)
}

export function CurrencyInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  helperText,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState('')

  const handleFocus = useCallback(() => {
    setFocused(true)
    // Show raw dollar amount for editing
    if (value !== 0) {
      setRawText(dollars(value).toString())
    } else {
      setRawText('')
    }
  }, [value])

  const handleBlur = useCallback(() => {
    setFocused(false)
    const parsed = parseToCents(rawText)
    onChange(parsed)
  }, [rawText, onChange])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRawText(e.target.value)
  }, [])

  const displayValue = focused ? rawText : formatDisplay(value)

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 flex items-center">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        inputMode="decimal"
        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
      />
      {helperText && (
        <span className="text-xs text-gray-500">{helperText}</span>
      )}
    </div>
  )
}
