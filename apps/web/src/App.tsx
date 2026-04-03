import { Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
      <Route path="/workspace/:workspaceId/sessions/:viewerId" element={<WorkspacePage />} />
    </Routes>
  )
}
