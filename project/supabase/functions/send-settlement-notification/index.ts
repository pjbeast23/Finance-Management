import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SettlementNotification {
  to_email: string
  to_name: string
  from_name: string
  amount: number
  expense_title: string
  payment_method: string
  notes?: string
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
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Get notification data from request body
    const notification: SettlementNotification = await req.json()

    console.log('=== SETTLEMENT NOTIFICATION DEBUG ===')
    console.log('Sending settlement notification to:', notification.to_email)
    console.log('From:', notification.from_name)
    console.log('Amount:', notification.amount)

    // Validate required fields
    if (!notification.to_email || !notification.to_name || !notification.from_name) {
      throw new Error('Missing required notification fields')
    }

    // Use your Resend API key
    const resendApiKey = 're_HasxVsvG_CppsBmZsZNUCNZ8VxtAAi9VL'

    // Create email content
    const emailSubject = `✅ Payment Confirmed: ${notification.expense_title}`
    const emailHtml = createEmailTemplate(notification)

    console.log('📧 Attempting to send settlement email via Resend API...')

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FinanceTracker <onboarding@resend.dev>',
        to: [notification.to_email],
        subject: emailSubject,
        html: emailHtml,
        text: createEmailText(notification)
      })
    })

    const emailResult = await emailResponse.json()
    
    console.log('📧 Resend API Response Status:', emailResponse.status)
    console.log('📧 Resend API Response:', emailResult)

    if (!emailResponse.ok) {
      console.error('❌ Resend API error:', emailResult)
      console.error('Response status:', emailResponse.status)
      
      // Return success to prevent blocking settlement
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Settlement processed successfully, but email notification failed',
          recipient: notification.to_email,
          email_error: emailResult.message || 'Email service error',
          debug: {
            status: emailResponse.status,
            error: emailResult
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Settlement email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Settlement notification sent successfully',
        recipient: notification.to_email,
        email_id: emailResult.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in send-settlement-notification function:', error)
    
    // Return success to prevent blocking settlement
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Settlement processed successfully, but email notification failed',
        error: error.message || 'Unknown error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function createEmailTemplate(notification: SettlementNotification): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmed</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 30px; }
        .settlement-card { background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .amount-highlight { font-size: 24px; font-weight: bold; color: #10b981; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">✅ Payment Confirmed</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment has been received</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hi <strong>${notification.to_name}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
            Great news! <strong>${notification.from_name}</strong> has confirmed receiving your payment:
          </p>
          
          <div class="settlement-card">
            <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">${notification.expense_title}</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount Paid:</td>
                <td style="padding: 8px 0; text-align: right;" class="amount-highlight">$${notification.amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937; text-transform: capitalize;">${notification.payment_method.replace('_', ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Confirmed Date:</td>
                <td style="padding: 8px 0; text-align: right; color: #1f2937;">${new Date().toLocaleDateString()}</td>
              </tr>
            </table>
            
            ${notification.notes ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #d1fae5;">
                <strong style="color: #6b7280;">Notes:</strong>
                <p style="margin: 5px 0 0 0; color: #374151;">${notification.notes}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 16px;">
              <strong>🎉 All settled!</strong> This expense has been marked as paid. Thank you!
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">This confirmation was sent from FinanceTracker</p>
          <p style="margin: 5px 0 0 0;">Keep track of your shared expenses with ease</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function createEmailText(notification: SettlementNotification): string {
  return `
Payment Confirmed: ${notification.expense_title}

Hi ${notification.to_name},

Great news! ${notification.from_name} has confirmed receiving your payment.

Payment Details:
- Expense: ${notification.expense_title}
- Amount Paid: $${notification.amount.toFixed(2)}
- Payment Method: ${notification.payment_method.replace('_', ' ')}
- Confirmed Date: ${new Date().toLocaleDateString()}
${notification.notes ? `- Notes: ${notification.notes}` : ''}

🎉 All settled! This expense has been marked as paid. Thank you!

This confirmation was sent from FinanceTracker.
  `
}