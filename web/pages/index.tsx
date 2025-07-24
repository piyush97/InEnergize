import Link from 'next/link';
import React from 'react';
import AppLayout from '../components/Layout/AppLayout';

const HomePage: React.FC = () => {
  return (
    <AppLayout showSidebar={false}>
      <div className="bg-white">
        {/* Hero section */}
        <div className="relative overflow-hidden">
          <div className="pt-16 pb-80 sm:pb-40 sm:pt-24 lg:pb-48 lg:pt-40">
            <div className="relative px-4 mx-auto max-w-7xl sm:static sm:px-6 lg:px-8">
              <div className="sm:max-w-lg">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                  Optimize Your LinkedIn Profile with{' '}
                  <span className="text-primary-600">AI Power</span>
                </h1>
                <p className="mt-4 text-xl text-gray-500">
                  Boost your job search success with AI-powered LinkedIn optimization, content generation, and smart networking automation.
                </p>
              </div>
              <div>
                <div className="mt-10">
                  {/* Decorative image grid */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none lg:absolute lg:inset-y-0 lg:mx-auto lg:w-full lg:max-w-7xl"
                  >
                    <div className="absolute transform sm:left-1/2 sm:top-0 sm:translate-x-8 lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-8">
                      <div className="flex items-center space-x-6 lg:space-x-8">
                        <div className="grid flex-shrink-0 grid-cols-1 gap-y-6 lg:gap-y-8">
                          <div className="h-64 overflow-hidden rounded-lg w-44 sm:opacity-0 lg:opacity-100">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-primary-400 to-primary-600">
                              <span className="font-semibold text-white">Profile Analysis</span>
                            </div>
                          </div>
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-linkedin-400 to-linkedin-600">
                              <span className="font-semibold text-white">Content Generator</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid flex-shrink-0 grid-cols-1 gap-y-6 lg:gap-y-8">
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-success-400 to-success-600">
                              <span className="font-semibold text-white">Smart Automation</span>
                            </div>
                          </div>
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-warning-400 to-warning-600">
                              <span className="font-semibold text-white">Analytics Dashboard</span>
                            </div>
                          </div>
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-purple-400 to-purple-600">
                              <span className="font-semibold text-white">Network Growth</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid flex-shrink-0 grid-cols-1 gap-y-6 lg:gap-y-8">
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-indigo-400 to-indigo-600">
                              <span className="font-semibold text-white">Post Scheduler</span>
                            </div>
                          </div>
                          <div className="h-64 overflow-hidden rounded-lg w-44">
                            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-pink-400 to-pink-600">
                              <span className="font-semibold text-white">AI Insights</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Link
                      href="/auth/signup"
                      className="px-8 py-3 text-lg btn-primary"
                    >
                      Get Started Free
                    </Link>
                    <Link
                      href="/auth/signin"
                      className="px-8 py-3 text-lg btn-secondary"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features section */}
        <div className="py-24 bg-gray-50 sm:py-32">
          <div className="px-6 mx-auto max-w-7xl lg:px-8">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Everything you need to succeed on LinkedIn
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Our AI-powered platform provides comprehensive tools to optimize your LinkedIn presence and accelerate your career growth.
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto mt-16 sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                <div className="flex flex-col">
                  <dt className="flex items-center text-base font-semibold leading-7 text-gray-900 gap-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    AI Profile Optimization
                  </dt>
                  <dd className="flex flex-col flex-auto mt-4 text-base leading-7 text-gray-600">
                    <p className="flex-auto">Get personalized recommendations to optimize your LinkedIn headline, summary, and experience sections for maximum visibility.</p>
                  </dd>
                </div>
                
                <div className="flex flex-col">
                  <dt className="flex items-center text-base font-semibold leading-7 text-gray-900 gap-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-4.5B0 11.625 3 3.375 3.375-3.375h-4.5A3.375 3.375 0 004.5 11.625v2.625M3.75 18.75v-4.5a1.125 1.125 0 011.125-1.125h12.5a1.125 1.125 0 011.125 1.125v4.5M3.75 18.75h16.5A1.875 1.875 0 0022.125 16.875v-4.5A1.875 1.875 0 0020.25 10.5H3.75a1.875 1.875 0 00-1.875 1.875v4.5A1.875 1.875 0 003.75 18.75z" />
                      </svg>
                    </div>
                    Content Generation
                  </dt>
                  <dd className="flex flex-col flex-auto mt-4 text-base leading-7 text-gray-600">
                    <p className="flex-auto">Create engaging LinkedIn posts, articles, and professional banners with our AI-powered content generation tools.</p>
                  </dd>
                </div>
                
                <div className="flex flex-col">
                  <dt className="flex items-center text-base font-semibold leading-7 text-gray-900 gap-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    Analytics & Insights
                  </dt>
                  <dd className="flex flex-col flex-auto mt-4 text-base leading-7 text-gray-600">
                    <p className="flex-auto">Track your LinkedIn performance with detailed analytics on profile views, post engagement, and network growth.</p>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* CTA section */}
        <div className="bg-primary-600">
          <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to transform your LinkedIn presence?
              </h2>
              <p className="max-w-xl mx-auto mt-6 text-lg leading-8 text-primary-200">
                Join thousands of professionals who have already boosted their LinkedIn success with InErgize.
              </p>
              <div className="flex items-center justify-center mt-10 gap-x-6">
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Start Free Trial
                </Link>
                <Link
                  href="/features"
                  className="text-sm font-semibold leading-6 text-white"
                >
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
                  

export default HomePage;