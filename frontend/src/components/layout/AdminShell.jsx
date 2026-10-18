import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import ErrorBoundary from '../ErrorBoundary'

export default function AdminShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mainRef = useRef(null)
  const { pathname } = useLocation()

  // Each page starts at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-app-bg text-text-primary">
      <div className="hidden w-60 shrink-0 border-r border-app-borderMuted lg:block">
        <AdminSidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-app-borderMuted bg-app-sidebar">
            <div className="flex justify-end p-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-1.5 text-text-secondary hover:bg-app-surface"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AdminSidebar onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onMenuClick={() => setMobileNavOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1280px] pb-6">
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
