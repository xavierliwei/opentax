import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SSNInput } from '../../../src/ui/components/SSNInput.tsx'

/** Wrapper that manages state so the controlled component works with userEvent */
function StatefulSSN({ masked, onChangeSpy }: { masked: boolean; onChangeSpy?: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <SSNInput
      label="SSN"
      value={value}
      onChange={(v) => { setValue(v); onChangeSpy?.(v) }}
      masked={masked}
    />
  )
}

describe('SSNInput', () => {
  it('displays masked SSN •••-••-1234 when masked=true', () => {
    render(<SSNInput label="SSN" value="123451234" onChange={() => {}} masked={true} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('•••-••-1234')
  })

  it('shows full SSN with dashes on focus', async () => {
    const user = userEvent.setup()
    render(<SSNInput label="SSN" value="123456789" onChange={() => {}} masked={true} />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    expect(input.value).toBe('•••-••-6789')
    await user.click(input)
    expect(input.value).toBe('123-45-6789')
  })

  it('auto-formats with dashes during typing', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(<StatefulSSN masked={false} onChangeSpy={onChangeSpy} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.type(input, '123456789')

    // onChange should have been called with progressively longer digit strings
    const calls = onChangeSpy.mock.calls.map((c: unknown[]) => c[0])
    // After typing all 9 digits, the last call should be the full SSN
    expect(calls[calls.length - 1]).toBe('123456789')
  })
})
