import { useOpenTax } from '../state/OpenTaxContext'

export function IntakePage() {
  const { model } = useOpenTax()

  return (
    <section>
      <h2>Intake Uploads</h2>
      <p>Upload placeholders for W-2 / 1099 docs (MVP uses mock documents and statuses).</p>
      <div className="card-grid">
        {model.documents.map((doc) => (
          <article className="card" key={doc.id}>
            <h3>{doc.kind}</h3>
            <p><strong>File:</strong> {doc.filename}</p>
            <p><strong>Status:</strong> {doc.status}</p>
            <p><strong>Parse confidence:</strong> {(doc.confidence * 100).toFixed(0)}%</p>
            <button type="button">Replace file</button>
          </article>
        ))}
      </div>
    </section>
  )
}
