import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { GroupProvider } from './contexts/GroupContext'
import Navbar from './components/Layout/Navbar'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Investments from './pages/Investments'
import Splitwise from './pages/Splitwise'
import Groups from './pages/Groups'
import Auth from './pages/Auth'
import LoadingSpinner from './components/UI/LoadingSpinner'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  return (
    <GroupProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8 max-w-7xl">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/splitwise" element={<Splitwise />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </GroupProvider>
  )
}

export default App