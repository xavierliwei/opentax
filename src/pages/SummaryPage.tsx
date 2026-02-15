import { computeDeterministicSummary, fmtCurrency } from '../data/mock'
import { useOpenTax } from '../state/OpenTaxContext'

export function SummaryPage() {
  const { model, setModel } = useOpenTax()
  const computed = computeDeterministicSummary(model)

  const refreshComputation = () => {
    setModel((prev) => ({
      ...prev,
      mappings: computed.mappings,
      computationNodes: computed.nodes,
    }))
  }

  const s = computed.summary

  return (
    <section>
      <h2>Compute + Explain</h2>
      <p>This is a deterministic demo pipeline. It is intentionally not real tax calculation.</p>
      <button onClick={refreshComputation}>Recompute deterministic outputs</button>

      <div className="card-grid">
        <article className="card"><h3>Gross income</h3><p>{fmtCurrency(s.grossIncomeCents)}</p></article>
        <article className="card"><h3>Adjustments</h3><p>{fmtCurrency(s.totalAdjustmentsCents)}</p></article>
        <article className="card"><h3>Taxable income</h3><p>{fmtCurrency(s.taxableIncomeCents)}</p></article>
        <article className="card"><h3>Estimated tax</h3><p>{fmtCurrency(s.estimatedTaxCents)}</p></article>
        <article className="card"><h3>Withholding (mock)</h3><p>{fmtCurrency(s.withholdingCents)}</p></article>
        <article className="card"><h3>{s.resultLabel === 'estimated_refund' ? 'Estimated refund' : 'Estimated amount due'}</h3><p>{fmtCurrency(s.estimatedRefundOrDueCents)}</p></article>
      </div>

      <h3>Computation Nodes (Explainability)</h3>
      <div className="stack">
        {computed.nodes.map((node) => (
          <article key={node.id} className="card">
            <p><strong>{node.label}</strong> — {fmtCurrency(node.outputCents)}</p>
            <p>Formula: <code>{node.formula}</code></p>
            <p>{node.explanation}</p>
          </article>
        ))}
      </div>

      <h3>Form Mappings</h3>
      <ul>
        {computed.mappings.map((m) => (
          <li key={m.id}>{m.form} line {m.line}: {fmtCurrency(m.valueCents)} <em>(from {m.sourceKey})</em></li>
        ))}
      </ul>
    </section>
  )
}
