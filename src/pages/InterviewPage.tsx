import { useOpenTax } from '../state/OpenTaxContext'

export function InterviewPage() {
  const { model, setModel } = useOpenTax()

  const updateAnswer = (id: string, answer: string) => {
    setModel((prev) => ({
      ...prev,
      interviewAnswers: prev.interviewAnswers.map((q) => (q.id === id ? { ...q, answer } : q)),
    }))
  }

  return (
    <section>
      <h2>Guided Interview</h2>
      <p>Question flow asks only relevant fields for this return profile.</p>
      <div className="stack">
        {model.interviewAnswers.map((q) => (
          <label key={q.id} className="card">
            <span>{q.question}</span>
            <input value={q.answer} onChange={(e) => updateAnswer(q.id, e.target.value)} />
          </label>
        ))}
      </div>
    </section>
  )
}
