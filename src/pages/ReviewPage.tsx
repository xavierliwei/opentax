import { fmtCurrency } from '../data/mock'
import { useOpenTax } from '../state/OpenTaxContext'

const checklist = [
  'Verify legal name and SSN values match Social Security records.',
  'Confirm each W-2/1099 amount against source PDF/statement.',
  'Review RSU basis adjustments to avoid double taxation.',
  'Check interview answers for missing deductions/credits.',
  'Print and sign federal return package before mailing.',
  'Attach W-2 copies and required statements for paper filing.',
]

export function ReviewPage() {
  const { model } = useOpenTax()

  return (
    <section>
      <h2>Review + Print Checklist</h2>
      <p>Paper-file prep view for final human review.</p>

      <article className="card">
        <h3>Taxpayer Snapshot</h3>
        <p>{model.taxpayer.firstName} {model.taxpayer.lastName} • Filing: {model.taxpayer.filingStatus.toUpperCase()} • State: {model.taxpayer.state}</p>
      </article>

      <article className="card">
        <h3>Document Packet</h3>
        <ul>
          {model.documents.map((doc) => (
            <li key={doc.id}>{doc.kind}: {doc.filename} ({doc.status})</li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h3>Income Events</h3>
        <ul>
          {model.incomeEvents.map((event) => (
            <li key={event.id}>{event.label}: {fmtCurrency(event.amountCents)}</li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h3>Print/Mail Checklist</h3>
        <ol>
          {checklist.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <button type="button" onClick={() => window.print()}>Print checklist</button>
      </article>
    </section>
  )
}
