import { useId, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { cents, dollars } from '../../model/traced.ts'

interface CurrencyInputProps {
  label: ReactNode
  value: number // integer cents
  onChange: (cents: number) => void
  placeholder?: string
  required?: boolean
  helperText?: string
  disabled?: boolean
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
  disabled,
}: CurrencyInputProps) {
  const helperId = useId()
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
      <label className={`text-sm font-medium flex items-center ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        inputMode="decimal"
        className={`border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent ${
          disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-300 bg-white text-gray-900'
        }`}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-describedby={helperText ? helperId : undefined}
      />
      {helperText && (
        <span id={helperId} className="text-xs text-gray-500">{helperText}</span>
      )}
    </div>
  )
}
