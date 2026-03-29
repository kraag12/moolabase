import './globals.css'
import GlobalFetchGuard from './components/GlobalFetchGuard'
import BottomNav from './components/BottomNav'
import RouteProgress from './components/RouteProgress'

export const metadata = {
  title: 'Moolabase',
  description: 'Jobs and services marketplace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* guard against aborted fetch runtime errors */}
        <GlobalFetchGuard />
        <RouteProgress />
        <div className="pb-24">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
