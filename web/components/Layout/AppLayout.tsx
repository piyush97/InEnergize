import React from 'react'
import { useSession } from 'next-auth/react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
  showHeader?: boolean
  showFooter?: boolean
  className?: string
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  showSidebar = true, 
  showHeader = true, 
  showFooter = true,
  className = ''
}) => {
  const { data: _session, status } = useSession()
  const isAuthenticated = status === 'authenticated'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {showHeader && <Header />}
      
      <div className="flex-1 flex">
        {showSidebar && isAuthenticated && (
          <div className="hidden lg:flex lg:flex-shrink-0">
            <div className="flex flex-col w-64">
              <Sidebar />
            </div>
          </div>
        )}
        
        <main className={`flex-1 ${className}`}>
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
      
      {showFooter && <Footer />}
    </div>
  )
}

export default AppLayout