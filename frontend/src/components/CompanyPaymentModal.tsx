import React, { useState, useEffect } from 'react';
import { X, Building2, CreditCard, Banknote, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { companyKhataService, CompanyKhataOverview } from '../utils/companyKhataApi';
import { moneyService, MoneyAccount } from '../utils/moneyApi';
import { formatAmount } from '../utils/formatters';

interface CompanyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCompanyId?: string;
  companiesList?: CompanyKhataOverview[];
}

const COMMON_BANKS = ['Meezan Bank', 'HBL', 'MCB Bank', 'UBL', 'Allied Bank', 'Bank Alfalah', 'Askari Bank', 'Easypaisa / JazzCash'];

export const CompanyPaymentModal: React.FC<CompanyPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCompanyId,
  companiesList = []
}) => {
  const [accounts, setAccounts] = useState<CompanyKhataOverview[]>(companiesList);
  const [companyId, setCompanyId] = useState<string>(preselectedCompanyId || '');
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [amount, setAmount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('Meezan Bank');
  const [customBank, setCustomBank] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [moneyAccounts, setMoneyAccounts] = useState<MoneyAccount[]>([]);
  const [selectedMoneyAccountId, setSelectedMoneyAccountId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (companiesList.length > 0) {
        setAccounts(companiesList);
        setCompanyId(preselectedCompanyId || (companiesList[0].account_id || companiesList[0].company_id));
      } else {
        // Fetch accounts if not passed
        companyKhataService.getOverview().then(data => {
          setAccounts(data);
          if (!preselectedCompanyId && data.length > 0) {
            setCompanyId(data[0].account_id || data[0].company_id);
          }
        }).catch(err => console.error(err));
        setCompanyId(preselectedCompanyId || '');
      }

      setPaymentDate(new Date());
      setPaymentMethod('ONLINE');
      setAmount('');
      setBankName('Meezan Bank');
      setCustomBank('');
      setTransactionId('');
      setRemarks('');
      setError('');
      setIsSubmitting(false);
      setSelectedMoneyAccountId('');
      moneyService.getAccounts().then(setMoneyAccounts).catch(() => {});
    }
  }, [isOpen, preselectedCompanyId, companiesList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!companyId) {
      setError('Please select a company account');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    const finalBank = paymentMethod === 'ONLINE'
      ? (bankName === 'Other' ? customBank.trim() : bankName)
      : undefined;

    if (paymentMethod === 'ONLINE' && !finalBank) {
      setError('Please select or specify the bank name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await companyKhataService.recordPayment({
        account_id: companyId,
        company_id: companyId,
        entry_date: paymentDate ? paymentDate.toISOString() : new Date().toISOString(),
        amount_paid: numAmount,
        payment_method: paymentMethod,
        bank_name: finalBank,
        transaction_id: paymentMethod === 'ONLINE' && transactionId.trim() ? transactionId.trim() : undefined,
        remarks: remarks.trim() || undefined,
        money_account_id: selectedMoneyAccountId || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to record company payment:', err);
      setError(err?.response?.data?.detail || 'Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAccount = accounts.find(c => (c.account_id || c.company_id) === companyId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 to-teal-600/10 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pay Company / Advance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Record cash or online payment to company ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Company Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Select Company *
            </label>
            {preselectedCompanyId ? (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-3">
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedAccount?.name || selectedAccount?.company_name || 'Company'}
                </span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold">
                No company accounts added yet. Please click "+ ADD COMPANY" first to add a company.
              </div>
            ) : (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
              >
                <option value="" disabled>-- Choose a Company Account --</option>
                {accounts.map((comp) => {
                  const id = comp.account_id || comp.company_id;
                  const label = comp.name || comp.company_name;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Payment Date & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Payment Date *
              </label>
              <CustomDatePicker
                selected={paymentDate}
                onChange={(date) => setPaymentDate(date)}
                placeholderText="Select Date"
                maxDate={new Date()}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Payment Mode *
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'ONLINE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
              </div>
            </div>
          </div>

          {/* Online Transfer Details */}
          {paymentMethod === 'ONLINE' && (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Bank / Payment Channel *
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  {COMMON_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Other">Other Bank...</option>
                </select>
                {bankName === 'Other' && (
                  <input
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Enter bank name"
                    className="w-full mt-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Transaction ID / Ref # <span className="text-gray-400 normal-case">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN-92847291 or Cheque #"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Amount Paid */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Amount Paid (Rs.) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                Rs.
              </span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 200000"
                required
                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Rs. {formatAmount(Number(amount))}
              </p>
            )}
          </div>

          {/* Deduct from My Account (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Deduct from My Account <span className="text-gray-400 normal-case">(Optional — for 2-way balance sync)</span>
            </label>
            {moneyAccounts.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No money accounts set up. Add one in Money Management to enable auto-deduction.</p>
            ) : (
              <select
                value={selectedMoneyAccountId}
                onChange={(e) => setSelectedMoneyAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
              >
                <option value="">-- Don't deduct (manual only) --</option>
                {moneyAccounts.map(ma => (
                  <option key={ma.id} value={ma.id}>
                    {ma.title}{ma.bank_name ? ` (${ma.bank_name})` : ''} — Rs. {ma.current_balance.toLocaleString()}
                  </option>
                ))}
              </select>
            )}
            {selectedMoneyAccountId && amount && parseFloat(amount) > 0 && (() => {
              const sel = moneyAccounts.find(m => m.id === selectedMoneyAccountId);
              if (!sel) return null;
              const newBal = sel.current_balance - parseFloat(amount);
              return (
                <p className={`mt-1.5 text-xs font-semibold ${newBal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  {sel.title} balance: Rs. {sel.current_balance.toLocaleString()} → Rs. {newBal.toLocaleString()}
                </p>
              );
            })()}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Remarks / Notes <span className="text-gray-400 normal-case">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Advance transfer against upcoming pesticide order"
              className="w-full px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || accounts.length === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyPaymentModal;
