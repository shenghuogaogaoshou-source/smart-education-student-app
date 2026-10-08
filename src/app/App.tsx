import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { AppStateProvider, useAppState } from './AppState'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { GuardianConsentPage } from '../features/auth/GuardianConsentPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { MainShell } from '../features/shell/MainShell'

function AppRoutes() {
  const { state } = useAppState()
  const navigate = useNavigate()

  if (state.isLoggedIn) return <MainShell />

  return (
    <Routes>
      <Route path="/register" element={<RegisterPage onBack={() => navigate('/login')} onGuardianRequired={() => navigate('/guardian-consent')} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage onBack={() => navigate('/login')} />} />
      <Route path="/guardian-consent" element={<GuardianConsentPage onBack={() => navigate('/register')} onComplete={() => navigate('/login')} />} />
      <Route path="*" element={<LoginPage onNavigate={(page) => navigate(page === 'register' ? '/register' : '/forgot-password')} />} />
    </Routes>
  )
}

export function App() {
  return (
    <div className="app-frame">
      <BrowserRouter>
        <AppStateProvider>
          <AppRoutes />
        </AppStateProvider>
      </BrowserRouter>
    </div>
  )
}
