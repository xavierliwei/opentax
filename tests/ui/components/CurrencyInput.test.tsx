import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CurrencyInput } from '../../../src/ui/components/CurrencyInput.tsx'

describe('CurrencyInput', () => {
  it('renders label and formatted value', () => {
    render(<CurrencyInput label="Wages" value={6000000} onChange={() => {}} />)
    expect(screen.getByText('Wages')).toBeDefined()
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('$60,000.00')
  })

  it('parses 60000 input → emits 6000000 cents on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CurrencyInput label="Income" value={0} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.clear(input)
    await user.type(input, '60000')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(6000000)
  })

  it('parses $60,000.00 input → emits 6000000 cents on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CurrencyInput label="Income" value={0} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.clear(input)
    await user.type(input, '$60,000.00')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(6000000)
  })

  it('displays $0.00 for zero value', () => {
    render(<CurrencyInput label="Tax" value={0} onChange={() => {}} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('$0.00')
  })

  it('shows helperText when provided', () => {
    render(
      <CurrencyInput
        label="Wages"
        value={0}
        onChange={() => {}}
        helperText="Enter your total wages"
      />,
    )
    expect(screen.getByText('Enter your total wages')).toBeDefined()
  })
})
