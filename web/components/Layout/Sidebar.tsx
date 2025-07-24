import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { 
  HomeIcon,
  UserIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  BoltIcon,
  CalendarIcon,
  UsersIcon
} from '@heroicons/react/24/outline'
import { classNames } from '../../utils/classNames'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Profile Analysis', href: '/dashboard/profile', icon: UserIcon },
  { name: 'Content Generator', href: '/dashboard/content', icon: DocumentTextIcon },
  { name: 'Post Scheduler', href: '/dashboard/scheduler', icon: CalendarIcon },
  { name: 'Automation', href: '/dashboard/automation', icon: BoltIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  { name: 'Network', href: '/dashboard/network', icon: UsersIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
]

const Sidebar: React.FC = () => {
  const router = useRouter()

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = router.pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={classNames(
                  isActive
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center pl-3 pr-2 py-2 border-l-4 text-sm font-medium transition-colors duration-200'
                )}
              >
                <item.icon
                  className={classNames(
                    isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
      
      {/* Upgrade CTA */}
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex-shrink-0 w-full group block">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-4 text-white">
            <div className="text-sm font-medium">Upgrade to Pro</div>
            <div className="text-xs text-primary-100 mt-1">
              Unlock advanced features and unlimited usage
            </div>
            <Link
              href="/dashboard/billing"
              className="mt-3 w-full inline-flex justify-center items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-primary-600 bg-white hover:bg-primary-50 transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar