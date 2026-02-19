import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DateInput } from '../../../src/ui/components/DateInput.tsx'
import { StateSelect } from '../../../src/ui/components/StateSelect.tsx'
import { RepeatableSection } from '../../../src/ui/components/RepeatableSection.tsx'
import { DocumentCard } from '../../../src/ui/components/DocumentCard.tsx'

describe('DateInput', () => {
  it('renders with label and value', () => {
    render(<DateInput label="Date of birth" value="1990-01-15" onChange={() => {}} />)
    expect(screen.getByText('Date of birth')).toBeDefined()
    const input = screen.getByDisplayValue('1990-01-15') as HTMLInputElement
    expect(input.type).toBe('date')
  })
})

describe('StateSelect', () => {
  it('renders all 56 options (50 states + DC + 5 territories)', () => {
    render(<StateSelect label="State" value="" onChange={() => {}} />)
    // 56 state/territory options + 1 placeholder = 57 total
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(57)
  })

  it('fires onChange with correct code', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StateSelect label="State" value="" onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox'), 'CA')
    expect(onChange).toHaveBeenCalledWith('CA')
  })
})

describe('RepeatableSection', () => {
  it('renders items via renderItem', () => {
    const items = ['W-2 from Acme', 'W-2 from Globex']
    render(
      <RepeatableSection
        label="W-2 Forms"
        items={items}
        renderItem={(item) => <span>{item}</span>}
        onAdd={() => {}}
        onRemove={() => {}}
      />,
    )
    expect(screen.getByText('W-2 from Acme')).toBeDefined()
    expect(screen.getByText('W-2 from Globex')).toBeDefined()
  })

  it('shows emptyMessage when no items', () => {
    render(
      <RepeatableSection
        label="1099s"
        items={[]}
        renderItem={() => null}
        onAdd={() => {}}
        onRemove={() => {}}
        emptyMessage="No 1099 forms added."
      />,
    )
    expect(screen.getByText('No 1099 forms added.')).toBeDefined()
  })

  it('disables add when maxItems reached', () => {
    render(
      <RepeatableSection
        label="Dependents"
        items={['Dep 1', 'Dep 2']}
        renderItem={(item) => <span>{item}</span>}
        onAdd={() => {}}
        onRemove={() => {}}
        maxItems={2}
      />,
    )
    const addBtn = screen.getByText('+ Add')
    expect((addBtn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('DocumentCard', () => {
  it('renders title, subtitle, and confidence indicator', () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    render(
      <DocumentCard
        title="W-2 from Acme Corp"
        subtitle="$60,000.00"
        onEdit={onEdit}
        onRemove={onRemove}
        confidence={0.85}
      />,
    )
    expect(screen.getByText('W-2 from Acme Corp')).toBeDefined()
    expect(screen.getByText('$60,000.00')).toBeDefined()
    expect(screen.getByText('85% confidence')).toBeDefined()
  })
})
