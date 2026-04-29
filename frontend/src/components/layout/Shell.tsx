import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { ToastViewport, TooltipProvider } from '@/components/ui'

export function Shell() {
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-bg">
        <Header />
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
        <Footer />
        <ToastViewport />
      </div>
    </TooltipProvider>
  )
}
