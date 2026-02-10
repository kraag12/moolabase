import './globals.css'
import BottomNav from './components/BottomNav'

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
        <div className="pb-24">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
