import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { IntakePage } from './pages/IntakePage'
import { InterviewPage } from './pages/InterviewPage'
import { SummaryPage } from './pages/SummaryPage'
import { ReviewPage } from './pages/ReviewPage'
import { OpenTaxProvider } from './state/OpenTaxContext'
import './styles.css'

function App() {
  return (
    <OpenTaxProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/intake" replace />} />
            <Route path="intake" element={<IntakePage />} />
            <Route path="interview" element={<InterviewPage />} />
            <Route path="summary" element={<SummaryPage />} />
            <Route path="review" element={<ReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </OpenTaxProvider>
  )
}

export default App
