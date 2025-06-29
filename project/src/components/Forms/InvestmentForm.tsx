import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { InvestmentService, Investment } from '../../lib/investments'
import { GroupInvestmentService } from '../../lib/groupServices'
import { Search, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

const INVESTMENT_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'other', label: 'Other' }
]

const investmentSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol too long'),
  name: z.string().min(1, 'Company name is required'),
  quantity: z.number().min(0.001, 'Quantity must be greater than 0'),
  purchase_price: z.number().min(0.01, 'Purchase price must be greater than 0'),
  current_price: z.number().min(0, 'Current price must be non-negative'),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  investment_type: z.enum(['stock', 'bond', 'crypto', 'etf', 'mutual_fund', 'other']),
  notes: z.string().optional()
})

type InvestmentFormData = z.infer<typeof investmentSchema>

interface InvestmentFormProps {
  investment?: Investment
  onSubmit: () => void
  onCancel: () => void
  isGroupMode?: boolean
  currentGroup?: any
}

const InvestmentForm: React.FC<InvestmentFormProps> = ({ 
  investment, 
  onSubmit, 
  onCancel, 
  isGroupMode = false, 
  currentGroup 
}) => {
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [mockMode, setMockMode] = useState(false)
  
  const investmentService = new InvestmentService()
  const groupInvestmentService = new GroupInvestmentService()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      symbol: investment?.symbol || '',
      name: investment?.name || '',
      quantity: investment?.quantity || 0,
      purchase_price: investment?.purchase_price || 0,
      current_price: investment?.current_price || 0,
      purchase_date: investment?.purchase_date ? investment.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0],
      investment_type: investment?.investment_type || 'stock',
      notes: investment?.notes || ''
    }
  })

  const handleSymbolSearch = async (keywords: string) => {
    if (keywords.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const results = await investmentService.searchSymbol(keywords)
      setSearchResults(results.slice(0, 10)) // Limit to 10 results
      
      // Check if we're in mock mode
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-stocks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await investmentService.getSession())?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.mock) {
          setMockMode(true)
        }
      }
    } catch (error) {
      console.error('Error searching symbols:', error)
      toast.error('Error searching symbols. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const selectSymbol = (result: any) => {
    setValue('symbol', result['1. symbol'])
    setValue('name', result['2. name'])
    setSearchResults([])
    setShowSearch(false)
  }

  const handleFormSubmit = async (data: InvestmentFormData) => {
    setLoading(true)
    try {
      // Validate symbol if it's a stock (skip validation for non-stocks or in edit mode)
      if (data.investment_type === 'stock' && !investment) {
        try {
          const isValid = await investmentService.validateSymbol(data.symbol)
          if (!isValid) {
            toast.error('Invalid stock symbol. Please check and try again.')
            setLoading(false)
            return
          }
        } catch (error) {
          // If validation fails due to API issues, show warning but allow submission
          console.warn('Symbol validation failed, proceeding anyway:', error)
          toast('⚠️ Could not validate symbol, but proceeding with submission', {
            duration: 4000,
          })
        }
      }

      const investmentData = {
        ...data,
        symbol: data.symbol.toUpperCase(),
        purchase_date: new Date(data.purchase_date).toISOString()
      }

      if (isGroupMode && currentGroup) {
        // Handle GROUP investment
        if (investment) {
          await groupInvestmentService.updateGroupInvestment(investment.id, investmentData)
          toast.success('Group investment updated successfully')
        } else {
          await groupInvestmentService.createGroupInvestment(currentGroup.id, investmentData)
          toast.success('Group investment added successfully')
        }
      } else {
        // Handle PERSONAL investment
        if (investment) {
          await investmentService.updateInvestment(investment.id, investmentData)
          toast.success('Personal investment updated successfully')
        } else {
          await investmentService.createInvestment(investmentData)
          toast.success('Personal investment added successfully')
        }
      }

      onSubmit()
    } catch (error: any) {
      console.error('Error saving investment:', error)
      toast.error(error.message || 'Error saving investment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Mode Indicator */}
      <div className={`mb-4 p-3 rounded-lg border-l-4 ${
        isGroupMode 
          ? 'bg-blue-50 border-blue-400 text-blue-800' 
          : 'bg-green-50 border-green-400 text-green-800'
      }`}>
        <p className="text-sm font-medium">
          {isGroupMode && currentGroup 
            ? `📈 Adding investment to group: "${currentGroup.name}"`
            : '👤 Adding to your personal portfolio'
          }
        </p>
      </div>

      {mockMode && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
            <p className="text-sm text-yellow-800">
              Demo mode: Using mock data. To get real stock data, configure your Alpha Vantage API key in Supabase.
            </p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Symbol *
            </label>
            <div className="relative">
              <input
                {...register('symbol')}
                type="text"
                className="input-field uppercase pr-10"
                placeholder="AAPL"
                style={{ textTransform: 'uppercase' }}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase()
                  setValue('symbol', value)
                  if (value.length >= 2) {
                    handleSymbolSearch(value)
                    setShowSearch(true)
                  } else {
                    setSearchResults([])
                    setShowSearch(false)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <Search className="h-4 w-4" />
              </button>
              
              {/* Search Results Dropdown */}
              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searching && (
                    <div className="p-3 text-center">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectSymbol(result)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{result['1. symbol']}</div>
                      <div className="text-sm text-gray-600 truncate">{result['2. name']}</div>
                      <div className="text-xs text-gray-500">{result['4. region']} • {result['3. type']}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.symbol && (
              <p className="text-error-600 text-sm mt-1">{errors.symbol.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Investment Type *
            </label>
            <select {...register('investment_type')} className="input-field">
              {INVESTMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {errors.investment_type && (
              <p className="text-error-600 text-sm mt-1">{errors.investment_type.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company/Asset Name *
          </label>
          <input
            {...register('name')}
            type="text"
            className="input-field"
            placeholder="Apple Inc."
          />
          {errors.name && (
            <p className="text-error-600 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity *
            </label>
            <input
              {...register('quantity', { valueAsNumber: true })}
              type="number"
              step="0.001"
              min="0"
              className="input-field"
              placeholder="10"
            />
            {errors.quantity && (
              <p className="text-error-600 text-sm mt-1">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Price *
            </label>
            <input
              {...register('purchase_price', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              placeholder="150.00"
            />
            {errors.purchase_price && (
              <p className="text-error-600 text-sm mt-1">{errors.purchase_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Price
            </label>
            <input
              {...register('current_price', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              placeholder="155.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Will be updated automatically when you refresh prices
            </p>
            {errors.current_price && (
              <p className="text-error-600 text-sm mt-1">{errors.current_price.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Date *
          </label>
          <input
            {...register('purchase_date')}
            type="date"
            className="input-field"
          />
          {errors.purchase_date && (
            <p className="text-error-600 text-sm mt-1">{errors.purchase_date.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="input-field"
            placeholder="Optional notes about this investment"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center space-x-2"
            disabled={loading}
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>
              {investment ? 'Update' : 'Add'} {isGroupMode ? 'Group' : 'Personal'} Investment
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default InvestmentForm