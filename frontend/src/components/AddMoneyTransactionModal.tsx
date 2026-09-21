import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, CreditCard, Banknote, Loader2, CheckCircle } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { moneyService, MoneyTransaction } from '../utils/moneyApi';
import { formatAmount } from '../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedAccountId?: string;
  editTransaction?: MoneyTransaction | null;
  defaultType?: 'DEPOSIT' | 'WITHDRAWAL';
}

const AddMoneyTransactionModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, preselectedAccountId, editTransaction, defaultType = 'DEPOSIT'
}) => {
  const [txType, setTxType] = useState<'DEPOSIT' | 'WITHDRAWAL'>(defaultType);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [txDate, setTxDate] = useState<Date | null>(new Date());
  const [tid, setTid] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editTransaction) {
        setTxType(editTransaction.type as 'DEPOSIT' | 'WITHDRAWAL');
        setAmount(String(editTransaction.amount));
        setPaymentMethod((editTransaction.payment_method as 'ONLINE' | 'CASH') || 'ONLINE');
        setTxDate(editTransaction.transaction_date ? new Date(editTransaction.transaction_date) : new Date());
        setTid(editTransaction.tid || '');
        setDescription(editTransaction.description || '');
      } else {
        setTxType(defaultType);
        setAmount('');
        setPaymentMethod('ONLINE');
        setTxDate(new Date());
        setTid('');
        setDescription('');
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, editTransaction, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { setError('Enter a valid amount greater than 0'); return; }

    try {
      setIsSubmitting(true);
      setError('');
      if (editTransaction) {
        await moneyService.updateTransaction(editTransaction.id, {
          transaction_date: txDate ? txDate.toISOString() : undefined,
          amount: numAmount,
          payment_method: paymentMethod,
          description: description.trim() || undefined,
          tid: tid.trim() || undefined,
        });
      } else {
        if (!preselectedAccountId) { setError('No account selected'); return; }
        await moneyService.createTransaction({
          account_id: preselectedAccountId,
          transaction_date: txDate ? txDate.toISOString() : undefined,
          type: txType,
          amount: numAmount,
          payment_method: paymentMethod,
          description: description.trim() || undefined,
          tid: tid.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDeposit = txType === 'DEPOSIT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r ${isDeposit ? 'from-emerald-600/10 to-teal-600/10 dark:from-emerald-950/20' : 'from-red-600/10 to-rose-600/10 dark:from-red-950/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDeposit ? 'bg-emerald-600' : 'bg-red-600'} text-white flex items-center justify-center shadow-md`}>
              {isDeposit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editTransaction ? 'Edit Transaction' : (isDeposit ? 'Record Deposit' : 'Record Withdrawal')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enter the transaction details below</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">{error}</div>
          )}

          {/* Type Toggle (only for new transactions) */}
          {!editTransaction && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Transaction Type *</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setTxType('DEPOSIT')}
                  className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
                    txType === 'DEPOSIT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                  <TrendingUp className="w-4 h-4" /> Deposit
                </button>
                <button type="button" onClick={() => setTxType('WITHDRAWAL')}
                  className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
                    txType === 'WITHDRAWAL' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                  <TrendingDown className="w-4 h-4" /> Withdrawal
                </button>
              </div>
            </div>
          )}

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Date *</label>
              <CustomDatePicker selected={txDate} onChange={date => setTxDate(date)} maxDate={new Date()} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Method *</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setPaymentMethod('ONLINE')}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'ONLINE' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                  <CreditCard className="w-3.5 h-3.5" /> Online
                </button>
                <button type="button" onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'CASH' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                  <Banknote className="w-3.5 h-3.5" /> Cash
                </button>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Amount (Rs.) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">Rs.</span>
              <input type="number" step="any" min="1" value={amount} onChange={e => setAmount(e.target.value)} required
                placeholder="Enter amount"
                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition" />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <p className={`mt-1 text-xs font-semibold ${isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isDeposit ? '+' : '-'} Rs. {formatAmount(Number(amount))}
              </p>
            )}
          </div>

          {/* TID (for online) */}
          {paymentMethod === 'ONLINE' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">TID / Transaction Ref # <span className="text-gray-400 normal-case">(Optional)</span></label>
              <input type="text" value={tid} onChange={e => setTid(e.target.value)}
                placeholder="e.g. TXN-928472918"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition text-sm" />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Description / Notes <span className="text-gray-400 normal-case">(Optional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Daily cash deposit from sales"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition text-sm" />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 ${isDeposit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition`}>
              {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving...</>) : (<><CheckCircle className="w-4 h-4" />{editTransaction ? 'Save Changes' : 'Record Transaction'}</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMoneyTransactionModal;
