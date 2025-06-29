import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AlphaVantageQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  lastUpdated: string
}

interface PriceUpdateResult {
  symbol: string
  oldPrice: number
  newPrice: number
  change: number
  changePercent: number
  success: boolean
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No authorization header provided' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized access' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Use the provided Alpha Vantage API key
    const alphaVantageApiKey = 'V7SI4JTGTNCMT0JE'

    // Get user's investments - include name field which is required
    const { data: investments, error: investmentsError } = await supabaseClient
      .from('investments')
      .select('id, symbol, name, current_price, user_id')
      .eq('user_id', user.id)

    if (investmentsError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch investments: ${investmentsError.message}` 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!investments || investments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No investments to update',
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get unique symbols
    const symbols = [...new Set(investments.map(inv => inv.symbol))]
    const results: PriceUpdateResult[] = []

    // Fetch quotes for each symbol with rate limiting
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]
      
      try {
        // Fetch quote from Alpha Vantage
        const quote = await fetchAlphaVantageQuote(symbol, alphaVantageApiKey)
        
        // Find all investments with this symbol
        const symbolInvestments = investments.filter(inv => inv.symbol === symbol)
        
        // Update each investment individually to avoid constraint violations
        for (const investment of symbolInvestments) {
          const oldPrice = investment.current_price
          const newPrice = quote.price
          const change = newPrice - oldPrice
          const changePercent = oldPrice > 0 ? (change / oldPrice) * 100 : 0

          // Update only the current_price and updated_at fields
          const { error: updateError } = await supabaseClient
            .from('investments')
            .update({
              current_price: newPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', investment.id)

          if (updateError) {
            console.error(`Error updating investment ${investment.id}:`, updateError)
            results.push({
              symbol,
              oldPrice,
              newPrice: oldPrice,
              change: 0,
              changePercent: 0,
              success: false,
              error: `Database update failed: ${updateError.message}`
            })
          } else {
            results.push({
              symbol,
              oldPrice,
              newPrice,
              change,
              changePercent,
              success: true
            })
          }
        }

        // Rate limiting: wait 12 seconds between requests (5 requests per minute limit)
        if (i < symbols.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 12000))
        }
      } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error)
        
        // Add failed result for this symbol
        const symbolInvestments = investments.filter(inv => inv.symbol === symbol)
        symbolInvestments.forEach(investment => {
          results.push({
            symbol,
            oldPrice: investment.current_price,
            newPrice: investment.current_price,
            change: 0,
            changePercent: 0,
            success: false,
            error: error.message || 'Failed to fetch quote'
          })
        })
      }
    }

    const successfulUpdates = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        updated: successfulUpdates
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in update-stock-prices function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchAlphaVantageQuote(symbol: string, apiKey: string): Promise<AlphaVantageQuote> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: HTTP ${response.status}`)
  }
  
  const data = await response.json()
  
  // Check for API error messages
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage: ${data['Error Message']}`)
  }
  
  if (data['Note']) {
    throw new Error('Alpha Vantage API rate limit exceeded. Please try again later.')
  }
  
  const quote = data['Global Quote']
  if (!quote || !quote['01. symbol']) {
    throw new Error(`No price data available for symbol: ${symbol}`)
  }

  return {
    symbol: quote['01. symbol'],
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['09. change']),
    changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    lastUpdated: quote['07. latest trading day']
  }
}