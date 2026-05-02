import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { ToastViewport, TooltipProvider } from '@/components/ui'
import { useScreenshotMode } from '@/hooks/useScreenshotMode'

export function Shell() {
  const screenshot = useScreenshotMode()
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-bg">
        {!screenshot && <Header />}
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
        {!screenshot && <Footer />}
        <ToastViewport />
      </div>
    </TooltipProvider>
  )
}
