import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Shell } from '@/components/layout/Shell'
import { RouteErrorBoundary } from '@/components/layout/ErrorBoundary'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'
import { Skeleton } from '@/components/ui'

const Landing = lazy(() => import('@/pages/Landing').then((m) => ({ default: m.Landing })))
const SimulatorPro = lazy(() =>
  import('@/pages/SimulatorPro').then((m) => ({ default: m.SimulatorPro })),
)
const SimulatorClassic = lazy(() =>
  import('@/pages/SimulatorClassic').then((m) => ({ default: m.SimulatorClassic })),
)
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const Scenarios = lazy(() =>
  import('@/pages/Scenarios').then((m) => ({ default: m.Scenarios })),
)
const About = lazy(() => import('@/pages/About').then((m) => ({ default: m.About })))

function PageFallback() {
  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
      <Skeleton className="h-7 w-64 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}

const wrap = (el: React.ReactNode) => (
  <AppErrorBoundary>
    <Suspense fallback={<PageFallback />}>{el}</Suspense>
  </AppErrorBoundary>
)

export const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <Shell />,
    children: [
      { path: '/', element: wrap(<Landing />), errorElement: <RouteErrorBoundary /> },
      { path: '/simulator/pro', element: wrap(<SimulatorPro />), errorElement: <RouteErrorBoundary /> },
      { path: '/simulator/classic', element: wrap(<SimulatorClassic />), errorElement: <RouteErrorBoundary /> },
      { path: '/dashboard', element: wrap(<Dashboard />), errorElement: <RouteErrorBoundary /> },
      { path: '/scenarios', element: wrap(<Scenarios />), errorElement: <RouteErrorBoundary /> },
      { path: '/about', element: wrap(<About />), errorElement: <RouteErrorBoundary /> },
      { path: '*', element: wrap(<Landing />) },
    ],
  },
])
