import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { SplitwiseService } from '../../lib/splitwise'
import { DollarSign, User } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

interface SettleUpModalProps {
  participantId: string
  participantName: string
  participantEmail: string
  amountOwed: number
  expenseTitle: string
  onClose: () => void
  onSettled: () => void
}

const SettleUpModal: React.FC<SettleUpModalProps> = ({
  participantId,
  participantName,
  participantEmail,
  amountOwed,
  expenseTitle,
  onClose,
  onSettled
}) => {
  const { user } = useAuth()
  const [settling, setSettling] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'venmo' | 'paypal' | 'bank_transfer' | 'other'>('cash')
  const [notes, setNotes] = useState('')

  const splitwiseService = new SplitwiseService()

  const handleSettleUp = async () => {
    setSettling(true)
    try {
      await splitwiseService.settleExpense(participantId, amountOwed)
      
      // Send settlement notification email
      await splitwiseService.sendSettlementNotification({
        to_email: participantEmail,
        to_name: participantName,
        from_name: user?.email?.split('@')[0] || 'Someone',
        amount: amountOwed,
        expense_title: expenseTitle,
        payment_method: paymentMethod,
        notes
      })

      toast.success(`${participantName} has been marked as settled!`)
      onSettled()
      onClose()
    } catch (error: any) {
      console.error('Error settling expense:', error)
      toast.error(error.message || 'Error settling expense')
    } finally {
      setSettling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-6 pt-5 pb-4">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-success-100 rounded-full mr-4">
                <DollarSign className="h-6 w-6 text-success-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Settle Up</h3>
                <p className="text-sm text-gray-500">Mark payment as received</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{participantName}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">Expense: {expenseTitle}</p>
                <p className="text-2xl font-bold text-success-600">${amountOwed.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="input-field"
                >
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="input-field"
                  placeholder="Add any notes about the payment..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will mark the payment as received and send a confirmation email to {participantName}.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={settling}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSettleUp}
              className="btn-primary flex items-center space-x-2"
              disabled={settling}
            >
              {settling && <LoadingSpinner size="sm" />}
              <span>Mark as Settled</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettleUpModal