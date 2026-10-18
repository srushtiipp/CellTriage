import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { VehicleDataProvider } from './context/VehicleDataContext'
import { RequireAuth, RequireVehicleUser, RequireAdmin } from './components/auth/Guards'
import AppShell from './components/layout/AppShell'
import AdminShell from './components/layout/AdminShell'

// Vehicle-user pages
import Login from './pages/Login'
import Overview from './pages/Overview'
import BatteryHealth from './pages/BatteryHealth'
import DigitalTwin from './pages/DigitalTwin'
import CellDiagnostics from './pages/CellDiagnostics'
import Charging from './pages/Charging'
import AIAssistant from './pages/AIAssistant'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

// Fleet admin pages
import FleetOverview from './pages/fleet/FleetOverview'
import FleetVehicles from './pages/fleet/FleetVehicles'
import FleetVehicleDetail from './pages/fleet/FleetVehicleDetail'
import FleetCompare from './pages/fleet/FleetCompare'
import FleetCopilot from './pages/fleet/FleetCopilot'
import FleetModelValidation from './pages/fleet/FleetModelValidation'
import FleetProfile from './pages/fleet/FleetProfile'

// Vehicle-user protected shell
function VehicleUserApp() {
  return (
    <RequireAuth>
      <RequireVehicleUser>
        <VehicleDataProvider>
          <AppShell />
        </VehicleDataProvider>
      </RequireVehicleUser>
    </RequireAuth>
  )
}

// Fleet-admin protected shell
function AdminApp() {
  return (
    <RequireAuth>
      <RequireAdmin>
        <AdminShell />
      </RequireAdmin>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ── Vehicle-user routes ───────────────────────────────────────── */}
        <Route element={<VehicleUserApp />}>
          <Route index element={<Overview />} />
          <Route path="battery-health" element={<BatteryHealth />} />
          <Route path="digital-twin" element={<DigitalTwin />} />
          <Route path="cell-diagnostics" element={<CellDiagnostics />} />
          <Route path="charging" element={<Charging />} />
          <Route path="ai-assistant" element={<AIAssistant />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* ── Fleet admin routes ────────────────────────────────────────── */}
        <Route path="fleet" element={<AdminApp />}>
          <Route index element={<FleetOverview />} />
          <Route path="vehicles" element={<FleetVehicles />} />

          {/* Individual vehicle detail: tabs rendered via nested Outlet */}
          <Route path="vehicles/:vehicleId" element={<FleetVehicleDetail />}>
            {/* Overview tab — reuses user Overview component via AdminVehicleDataContext */}
            <Route index element={<Overview />} />
            <Route path="battery-health" element={<BatteryHealth />} />
            <Route path="digital-twin" element={<DigitalTwin />} />
            <Route path="cell-diagnostics" element={<CellDiagnostics />} />
            <Route path="charging" element={<Charging />} />
          </Route>

          <Route path="compare" element={<FleetCompare />} />
          <Route path="copilot" element={<FleetCopilot />} />
          <Route path="model-validation" element={<FleetModelValidation />} />
          <Route path="profile" element={<FleetProfile />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
