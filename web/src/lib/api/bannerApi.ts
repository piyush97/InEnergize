import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'

// Types
export interface BrandingOptions {
  companyName?: string
  role?: string
  tagline?: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  websiteUrl?: string
}

export interface BannerGenerationRequest {
  industry: string
  style?: 'natural' | 'vivid'
  branding?: BrandingOptions
  textElements?: string[]
  colorScheme?: string
  additionalContext?: string
}

export interface BannerGenerationResult {
  id: string
  imageUrl: string
  imageData: string
  dimensions: { width: number; height: number }
  format: string
  fileSize: number
  prompt: string
  altTexts: string[]
  metadata: {
    industry: string
    style?: string
    generatedAt: Date
    dalleModel: string
    version: string
  }
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  isLinkedInCompliant: boolean
  qualityScore: number
}

export interface BannerTemplate {
  id: string
  name: string
  description: string
  industry: string
  colorSchemes: string[]
  designElements: string[]
  keywords: string[]
  professionalTone: string
}

export interface LinkedInSpecs {
  width: number
  height: number
  aspectRatio: number
  maxFileSize: number
  supportedFormats: string[]
  dpi: number
  colorSpace: string
}

// Create axios instance with auth
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for image generation
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      window.location.href = '/auth/signin'
    }
    return Promise.reject(error)
  }
)

export class BannerApi {
  /**
   * Generate a single LinkedIn banner
   */
  static async generateBanner(request: BannerGenerationRequest): Promise<BannerGenerationResult> {
    try {
      const response = await apiClient.post('/api/v1/banner/generate', request)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to generate banner')
      }
      
      return response.data.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to generate banner'
      throw new Error(message)
    }
  }

  /**
   * Generate multiple banner variations
   */
  static async generateBannerVariations(
    request: BannerGenerationRequest, 
    count: number = 3
  ): Promise<BannerGenerationResult[]> {
    try {
      const response = await apiClient.post('/api/v1/banner/variations', {
        ...request,
        count
      })
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to generate variations')
      }
      
      return response.data.data.variations
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to generate variations'
      throw new Error(message)
    }
  }

  /**
   * Get available banner templates
   */
  static async getTemplates(): Promise<BannerTemplate[]> {
    try {
      const response = await apiClient.get('/api/v1/banner/templates')
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to load templates')
      }
      
      return response.data.data.templates
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to load templates'
      throw new Error(message)
    }
  }

  /**
   * Get LinkedIn banner specifications
   */
  static async getLinkedInSpecs(): Promise<LinkedInSpecs> {
    try {
      const response = await apiClient.get('/api/v1/banner/specs')
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to load specifications')
      }
      
      return response.data.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to load specifications'
      throw new Error(message)
    }
  }

  /**
   * Preview banner prompt and settings (no image generation)
   */
  static async previewPrompt(request: BannerGenerationRequest): Promise<{
    industry: string
    branding?: BrandingOptions
    textElements?: string[]
    estimatedPrompt: string
    estimatedCost: number
    qualityFactors: {
      industryAlignment: number
      brandingCompleteness: number
      textOptimization: number
    }
  }> {
    try {
      const response = await apiClient.post('/api/v1/banner/preview', request)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to preview prompt')
      }
      
      return response.data.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to preview prompt'
      throw new Error(message)
    }
  }

  /**
   * Get user's generated banners
   */
  static async getUserBanners(options?: {
    page?: number
    limit?: number
    industry?: string
    sortBy?: 'newest' | 'oldest' | 'quality' | 'downloads'
  }): Promise<{
    banners: BannerGenerationResult[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      const params = new URLSearchParams()
      if (options?.page) params.append('page', options.page.toString())
      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.industry) params.append('industry', options.industry)
      if (options?.sortBy) params.append('sortBy', options.sortBy)

      const response = await apiClient.get(`/api/v1/banner/my-banners?${params}`)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to load banners')
      }
      
      return response.data.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to load banners'
      throw new Error(message)
    }
  }

  /**
   * Delete a banner
   */
  static async deleteBanner(bannerId: string): Promise<void> {
    try {
      const response = await apiClient.delete(`/api/v1/banner/${bannerId}`)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to delete banner')
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete banner'
      throw new Error(message)
    }
  }

  /**
   * Update banner metadata
   */
  static async updateBanner(bannerId: string, updates: {
    name?: string
    description?: string
    tags?: string[]
    isPublic?: boolean
  }): Promise<void> {
    try {
      const response = await apiClient.patch(`/api/v1/banner/${bannerId}`, updates)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to update banner')
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to update banner'
      throw new Error(message)
    }
  }

  /**
   * Download banner (tracks download count)
   */
  static async downloadBanner(bannerId: string): Promise<Blob> {
    try {
      const response = await apiClient.get(`/api/v1/banner/${bannerId}/download`, {
        responseType: 'blob'
      })
      
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to download banner'
      throw new Error(message)
    }
  }

  /**
   * Get banner usage analytics
   */
  static async getBannerAnalytics(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<{
    totalGenerated: number
    totalDownloads: number
    averageQualityScore: number
    mostPopularIndustries: Array<{ industry: string; count: number }>
    costBreakdown: {
      totalCost: number
      averageCostPerBanner: number
      costByStyle: Array<{ style: string; cost: number }>
    }
    qualityTrends: Array<{ date: string; averageScore: number }>
  }> {
    try {
      const response = await apiClient.get(`/api/v1/banner/analytics?timeframe=${timeframe}`)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to load analytics')
      }
      
      return response.data.data
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to load analytics'
      throw new Error(message)
    }
  }
}

// Export default instance
export default BannerApi