import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailNotification {
  to_email: string
  to_name: string
  from_name: string
  expense_title: string
  expense_description?: string
  total_amount: number
  amount_owed: number
  expense_date: string
  split_method: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 Email function started')
    console.log('📧 Request method:', req.method)
    console.log('📧 Request URL:', req.url)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('🔑 Auth header present:', !!authHeader)
    
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      throw new Error('Unauthorized')
    }

    console.log('✅ User authenticated:', user.email)

    // Get notification data from request body
    const notification: EmailNotification = await req.json()

    console.log('=== EMAIL NOTIFICATION DEBUG ===')
    console.log('📧 To:', notification.to_email)
    console.log('📧 From:', notification.from_name)
    console.log('📧 Expense:', notification.expense_title)
    console.log('📧 Amount owed:', notification.amount_owed)

    // Validate required fields
    if (!notification.to_email || !notification.to_name || !notification.from_name) {
      throw new Error('Missing required notification fields')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(notification.to_email)) {
      throw new Error(`Invalid email format: ${notification.to_email}`)
    }

    // Use your Resend API key
    const resendApiKey = 're_HasxVsvG_CppsBmZsZNUCNZ8VxtAAi9VL'
    
    console.log('🔑 Using Resend API key:', resendApiKey.substring(0, 10) + '...')

    // Create email content
    const emailSubject = `💰 New Shared Expense: ${notification.expense_title}`
    const emailHtml = createEmailTemplate(notification)
    const emailText = createEmailText(notification)

    console.log('📧 Email subject:', emailSubject)
    console.log('📧 Email HTML length:', emailHtml.length)
    console.log('📧 Email text length:', emailText.length)

    const emailPayload = {
      from: 'FinanceTracker <onboarding@resend.dev>',
      to: [notification.to_email],
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    }

    console.log('📧 Email payload:', JSON.stringify(emailPayload, null, 2))

    console.log('🌐 Sending request to Resend API...')

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    })

    console.log('📧 Resend API Response Status:', emailResponse.status)
    console.log('📧 Resend API Response Headers:', Object.fromEntries(emailResponse.headers.entries()))
    
    const emailResult = await emailResponse.json()
    console.log('📧 Resend API Response Body:', JSON.stringify(emailResult, null, 2))
    
    if (!emailResponse.ok) {
      console.error('❌ Resend API error details:')
      console.error('Status:', emailResponse.status)
      console.error('Response:', emailResult)
      
      // Check for specific error types
      if (emailResponse.status === 422) {
        console.error('❌ Validation error - check email format and content')
      } else if (emailResponse.status === 401) {
        console.error('❌ Authentication error - check API key')
      } else if (emailResponse.status === 429) {
        console.error('❌ Rate limit exceeded')
      }
      
      // Return detailed error for debugging
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email sending failed',
          details: {
            status: emailResponse.status,
            message: emailResult.message || 'Unknown error',
            resend_error: emailResult,
            api_key_prefix: resendApiKey.substring(0, 10) + '...',
            payload: emailPayload
          }
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Email sent successfully!')
    console.log('📧 Email ID:', emailResult.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email notification sent successfully',
        recipient: notification.to_email,
        email_id: emailResult.id,
        debug: {
          api_key_used: resendApiKey.substring(0, 10) + '...',
          resend_response: emailResult
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in send-expense-notification function:', error)
    console.error('❌ Error stack:', error.stack)
    
    // Return detailed error for debugging
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred',
        debug: {
          error_type: error.constructor.name,
          error_message: error.message,
          error_stack: error.stack
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function createEmailTemplate(notification: EmailNotification): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Shared Expense</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 30px; }
        .expense-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .amount-highlight { font-size: 24px; font-weight: bold; color: #dc2626; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">💰 New Shared Expense</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been added to a shared expense</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hi <strong>${notification.to_name}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
            <strong>${notification.from_name}</strong> has added you to a new shared expense:
          </p>
          
          <div class="expense-card">
            <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">${notification.expense_title}</h2>
            ${notification.expense_description ? `<p style="margin: 0 0 15px 0; color: #6b7280;">${notification.expense_description}</p>` : ''}
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1f2937;">$${notification.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Your Share:</td>
                <td style="padding: 8px 0; text-align: right;" class="amount-highlight">$${notification.amount_owed.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Split Method:</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; text-transform: capitalize;">${notification.split_method.replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date:</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937;">${new Date(notification.expense_date).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>💡 Next Steps:</strong> Contact ${notification.from_name} to arrange payment of your $${notification.amount_owed.toFixed(2)} share.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">This notification was sent from FinanceTracker</p>
          <p style="margin: 5px 0 0 0;">Manage your shared expenses easily and transparently</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function createEmailText(notification: EmailNotification): string {
  return `
New Shared Expense: ${notification.expense_title}

Hi ${notification.to_name},

${notification.from_name} has added you to a new shared expense.

Expense Details:
- Title: ${notification.expense_title}
${notification.expense_description ? `- Description: ${notification.expense_description}` : ''}
- Total Amount: $${notification.total_amount.toFixed(2)}
- Your Share: $${notification.amount_owed.toFixed(2)}
- Split Method: ${notification.split_method.replace('_', ' ')}
- Date: ${new Date(notification.expense_date).toLocaleDateString()}

Next Steps: Contact ${notification.from_name} to arrange payment of your $${notification.amount_owed.toFixed(2)} share.

This notification was sent from FinanceTracker.
  `
}