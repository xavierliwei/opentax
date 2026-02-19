import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './ui/components/AppShell.tsx'
import { InterviewRouter } from './ui/pages/InterviewRouter.tsx'
import { WelcomePage } from './ui/pages/WelcomePage.tsx'
import { ExplainView } from './ui/pages/ExplainView.tsx'
import { DashboardLayout } from './ui/pages/DashboardLayout.tsx'
import { DashboardPage } from './ui/pages/DashboardPage.tsx'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WelcomePage />} />
          <Route path="interview/:stepId" element={<InterviewRouter />} />
          <Route path="review" element={<InterviewRouter />} />
          <Route path="download" element={<InterviewRouter />} />
          <Route path="explain/:nodeId" element={<ExplainView />} />
        </Route>
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
