'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { 
  PhotoIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  ShareIcon,
  StarIcon,
  FilterIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface Banner {
  id: string
  name?: string
  description?: string
  industry: string
  style: string
  imageUrl: string
  imageData?: string
  format: string
  fileSize: number
  dimensions: { width: number; height: number }
  qualityScore: number
  isLinkedInCompliant: boolean
  downloadCount: number
  isPublic: boolean
  tags: string[]
  generationCost: number
  branding?: any
  textElements: string[]
  altTexts: string[]
  createdAt: string
  lastUsedAt?: string
}

interface FilterOptions {
  industry: string
  style: string
  minQualityScore: number
  isPublic: boolean | null
  sortBy: 'newest' | 'oldest' | 'quality' | 'downloads'
}

export const BannerGallery: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([])
  const [filteredBanners, setFilteredBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBanners, setSelectedBanners] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    industry: '',
    style: '',
    minQualityScore: 0,
    isPublic: null,
    sortBy: 'newest'
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)

  useEffect(() => {
    loadBanners()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [banners, searchQuery, filters])

  const loadBanners = async () => {
    try {
      setLoading(true)
      // This would be the actual API call to get user's banners
      // For now, we'll simulate with mock data
      const response = await axios.get('/api/v1/banner/my-banners')
      if (response.data.success) {
        setBanners(response.data.data.banners || [])
      }
    } catch (error) {
      console.error('Failed to load banners:', error)
      // Mock data for demo
      setBanners([])
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = banners

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(banner =>
        banner.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        banner.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        banner.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        banner.branding?.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Industry filter
    if (filters.industry) {
      filtered = filtered.filter(banner => banner.industry === filters.industry)
    }

    // Style filter
    if (filters.style) {
      filtered = filtered.filter(banner => banner.style === filters.style)
    }

    // Quality score filter
    if (filters.minQualityScore > 0) {
      filtered = filtered.filter(banner => banner.qualityScore >= filters.minQualityScore)
    }

    // Public filter
    if (filters.isPublic !== null) {
      filtered = filtered.filter(banner => banner.isPublic === filters.isPublic)
    }

    // Sort
    filtered = filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'quality':
          return b.qualityScore - a.qualityScore
        case 'downloads':
          return b.downloadCount - a.downloadCount
        default:
          return 0
      }
    })

    setFilteredBanners(filtered)
    setCurrentPage(1)
  }

  const downloadBanner = async (banner: Banner) => {
    try {
      const link = document.createElement('a')
      link.href = banner.imageUrl
      link.download = `${banner.name || 'linkedin-banner'}-${banner.id}.${banner.format.toLowerCase()}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Update download count
      setBanners(prev =>
        prev.map(b =>
          b.id === banner.id
            ? { ...b, downloadCount: b.downloadCount + 1 }
            : b
        )
      )
      
      toast.success('Banner downloaded!')
    } catch (error) {
      toast.error('Failed to download banner')
    }
  }

  const deleteBanner = async (bannerId: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return

    try {
      await axios.delete(`/api/v1/banner/${bannerId}`)
      setBanners(prev => prev.filter(b => b.id !== bannerId))
      setSelectedBanners(prev => {
        const newSet = new Set(prev)
        newSet.delete(bannerId)
        return newSet
      })
      toast.success('Banner deleted!')
    } catch (error) {
      toast.error('Failed to delete banner')
    }
  }

  const toggleBannerSelection = (bannerId: string) => {
    setSelectedBanners(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bannerId)) {
        newSet.delete(bannerId)
      } else {
        newSet.add(bannerId)
      }
      return newSet
    })
  }

  const bulkDelete = async () => {
    if (selectedBanners.size === 0) return
    if (!confirm(`Delete ${selectedBanners.size} selected banners?`)) return

    try {
      await Promise.all(
        Array.from(selectedBanners).map(id =>
          axios.delete(`/api/v1/banner/${id}`)
        )
      )
      setBanners(prev => prev.filter(b => !selectedBanners.has(b.id)))
      setSelectedBanners(new Set())
      toast.success(`Deleted ${selectedBanners.size} banners!`)
    } catch (error) {
      toast.error('Failed to delete some banners')
    }
  }

  const bulkDownload = async () => {
    if (selectedBanners.size === 0) return

    const selectedBannerItems = banners.filter(b => selectedBanners.has(b.id))
    for (const banner of selectedBannerItems) {
      await downloadBanner(banner)
      // Small delay to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredBanners.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentBanners = filteredBanners.slice(startIndex, endIndex)

  const industries = [...new Set(banners.map(b => b.industry))]
  const styles = [...new Set(banners.map(b => b.style))]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <PhotoIcon className="h-8 w-8 mr-3 text-purple-600" />
            Banner Gallery
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your generated LinkedIn banners ({filteredBanners.length} total)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {selectedBanners.size > 0 && (
            <>
              <button
                onClick={bulkDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Download ({selectedBanners.size})
              </button>
              <button
                onClick={bulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete ({selectedBanners.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search banners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            Filters
          </button>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="grid">Grid View</option>
            <option value="list">List View</option>
          </select>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
              <select
                value={filters.industry}
                onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              >
                <option value="">All Industries</option>
                {industries.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Style</label>
              <select
                value={filters.style}
                onChange={(e) => setFilters(prev => ({ ...prev, style: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              >
                <option value="">All Styles</option>
                {styles.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Min Quality</label>
              <select
                value={filters.minQualityScore}
                onChange={(e) => setFilters(prev => ({ ...prev, minQualityScore: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              >
                <option value={0}>Any Quality</option>
                <option value={60}>60+ Score</option>
                <option value={80}>80+ Score</option>
                <option value={90}>90+ Score</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={filters.isPublic === null ? '' : filters.isPublic.toString()}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  isPublic: e.target.value === '' ? null : e.target.value === 'true' 
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              >
                <option value="">All</option>
                <option value="false">Private</option>
                <option value="true">Public</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="quality">Highest Quality</option>
                <option value="downloads">Most Downloaded</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Banner Grid/List */}
      {currentBanners.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <PhotoIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No banners found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {currentBanners.map((banner) => (
            <div
              key={banner.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
                viewMode === 'list' ? 'flex' : ''
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedBanners.has(banner.id)}
                  onChange={() => toggleBannerSelection(banner.id)}
                  className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>

              {/* Banner Image */}
              <div className={`relative ${viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}`}>
                <img
                  src={banner.imageUrl}
                  alt={banner.altTexts[0] || 'LinkedIn banner'}
                  className="w-full h-auto"
                  style={{ aspectRatio: '1584/396' }}
                />
                
                {/* Quality Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    banner.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                    banner.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {banner.qualityScore}
                  </span>
                </div>
              </div>

              {/* Banner Info */}
              <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {banner.name || `${banner.industry} Banner`}
                    </h3>
                    <p className="text-sm text-gray-600">{banner.industry} • {banner.style}</p>
                  </div>
                  
                  {banner.isPublic && (
                    <ShareIcon className="h-4 w-4 text-blue-500" title="Public banner" />
                  )}
                </div>

                {banner.branding?.companyName && (
                  <p className="text-sm text-gray-700 mb-2">{banner.branding.companyName}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{Math.round(banner.fileSize / 1024)}KB</span>
                  <span>{banner.downloadCount} downloads</span>
                  <span>{format(new Date(banner.createdAt), 'MMM d, yyyy')}</span>
                </div>

                {/* Tags */}
                {banner.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {banner.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {banner.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{banner.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadBanner(banner)}
                    className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center text-sm"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                    Download
                  </button>
                  
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete banner"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredBanners.length)} of {filteredBanners.length} banners
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 border rounded-md ${
                    currentPage === page
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}