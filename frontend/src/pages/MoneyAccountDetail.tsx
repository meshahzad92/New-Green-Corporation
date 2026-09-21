import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Banknote, Building2, Wallet, TrendingUp, TrendingDown,
  Edit2, Trash2, Loader2, RefreshCw, CreditCard, Send, Calendar, Filter
} from 'lucide-react';
import { moneyService, MoneyAccountLedger, MoneyTransaction } from '../utils/moneyApi';
import AddMoneyTransactionModal from '../components/AddMoneyTransactionModal';
import TransferMoneyModal from '../components/TransferMoneyModal';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatAmount } from '../utils/formatters';

const typeConfig: Record<string, { label: string; color: string; Icon: any }> = {
  DEPOSIT: { label: 'Deposit', color: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400', Icon: TrendingUp },
  WITHDRAWAL: { label: 'Withdrawal', color: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400', Icon: TrendingDown },
  OPENING: { label: 'Opening Balance', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', Icon: Banknote },
  COMPANY_PAYMENT: { label: 'Company Payment', color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400', Icon: CreditCard },
};

const formatDateStr = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

type DateFilterMode = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_MONTH' | 'CUSTOM';

const MoneyAccountDetail: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [ledger, setLedger] = useState<MoneyAccountLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddTx, setShowAddTx] = useState(false);
  const [addTxType, setAddTxType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [showTransfer, setShowTransfer] = useState(false);
  const [editTx, setEditTx] = useState<MoneyTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<MoneyTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('ALL');
  const [customDate, setCustomDate] = useState<Date | null>(new Date());

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError('');
      const data = await moneyService.getLedger(accountId);
      setLedger(data);
    } catch (e: any) {
      setError('Failed to load account ledger');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteTx = async () => {
    if (!deleteTx || isDeleting) return;
    try {
      setIsDeleting(true);
      await moneyService.deleteTransaction(deleteTx.id);
      setDeleteTx(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  const isIncoming = (type: string) => ['DEPOSIT', 'OPENING'].includes(type);

  // Filtered Transactions Calculation based on Date Filter
  const filteredTransactions = useMemo(() => {
    if (!ledger) return [];
    if (dateFilter === 'ALL') return ledger.transactions;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return ledger.transactions.filter(t => {
      const tDate = new Date(t.transaction_date);
      const tDateStr = t.transaction_date.split('T')[0];

      if (dateFilter === 'TODAY') {
        return tDateStr === todayStr;
      }
      if (dateFilter === 'YESTERDAY') {
        return tDateStr === yesterdayStr;
      }
      if (dateFilter === 'THIS_MONTH') {
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      }
      if (dateFilter === 'CUSTOM' && customDate) {
        const customStr = customDate.toISOString().split('T')[0];
        return tDateStr === customStr;
      }
      return true;
    });
  }, [ledger, dateFilter, customDate]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
  if (error || !ledger) return (
    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400">
      {error || 'Account not found'}
    </div>
  );

  const acc = ledger.account;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/money')}
          className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${acc.account_type === 'BANK' ? 'bg-blue-600' : 'bg-emerald-600'} text-white flex items-center justify-center`}>
              {acc.account_type === 'BANK' ? <Building2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{acc.title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{acc.bank_name || acc.account_type}{acc.account_number ? ` · ${acc.account_number}` : ''}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setAddTxType('DEPOSIT'); setShowAddTx(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm">
            <TrendingUp className="w-3.5 h-3.5" /> Deposit
          </button>
          <button onClick={() => { setAddTxType('WITHDRAWAL'); setShowAddTx(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-sm">
            <TrendingDown className="w-3.5 h-3.5" /> Withdraw
          </button>
          <button onClick={() => setShowTransfer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition shadow-md">
            <Send className="w-3.5 h-3.5" /> Transfer
          </button>
        </div>
      </div>

      {/* Summary Banner (Total Available Balance ALWAYS Prominently Written at Top) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Available Balance Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-blue-900/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <p className="text-xs font-black uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
            <Wallet className="w-4 h-4" /> Available Account Balance
          </p>
          <p className="text-3xl sm:text-4xl font-black text-white mt-2 tracking-tight">
            Rs. {formatAmount(acc.current_balance)}
          </p>
          <p className="text-xs text-blue-200/70 mt-2">
            {acc.title} ({acc.bank_name || acc.account_type})
          </p>
        </div>

        {/* Deposits & Withdrawals Cards */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Deposits</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2">+ Rs. {formatAmount(ledger.total_deposits)}</p>
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-2">All-time credited funds</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Total Withdrawals & Payments</p>
              <p className="text-2xl sm:text-3xl font-black text-red-700 dark:text-red-300 mt-2">- Rs. {formatAmount(ledger.total_withdrawals)}</p>
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-2">All-time debited funds</p>
          </div>
        </div>
      </div>

      {/* Date Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filter History by Date:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDateFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
              dateFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Dates ({ledger.transactions.length})
          </button>
          <button
            onClick={() => setDateFilter('TODAY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
              dateFilter === 'TODAY'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('YESTERDAY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
              dateFilter === 'YESTERDAY'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setDateFilter('THIS_MONTH')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
              dateFilter === 'THIS_MONTH'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            This Month
          </button>

          {/* Custom Date Picker */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
            <button
              onClick={() => setDateFilter('CUSTOM')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                dateFilter === 'CUSTOM' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" /> Custom
            </button>
            {dateFilter === 'CUSTOM' && (
              <div className="w-36">
                <CustomDatePicker
                  selectedDate={customDate}
                  onChange={d => { setCustomDate(d); setDateFilter('CUSTOM'); }}
                  maxDate={new Date()}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Transaction History</h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing {filteredTransactions.length} of {ledger.transactions.length} entries
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <Banknote className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No transactions found for selected date filter</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">Switch dates or add a new transaction above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">TID</th>
                  <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Running Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {[...filteredTransactions].reverse().map(txn => {
                  const cfg = typeConfig[txn.type] || typeConfig.DEPOSIT;
                  const incoming = isIncoming(txn.type);
                  return (
                    <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs font-medium whitespace-nowrap">
                        {formatDateStr(txn.transaction_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                          <cfg.Icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs max-w-xs truncate" title={txn.description || ''}>
                        {txn.description || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">
                        {txn.tid || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                        <span className={incoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                          {incoming ? '+' : '-'} Rs. {formatAmount(txn.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black whitespace-nowrap">
                        <span className={(txn.running_balance ?? 0) >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}>
                          Rs. {formatAmount(txn.running_balance ?? 0)}
                        </span>
                      </td>
                      {/* FULL TRANSACTION CONTROL: EDIT & DELETE EVERY TRANSACTION */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditTx(txn); setShowAddTx(true); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition" title="Edit transaction">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTx(txn)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="Delete transaction">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Transaction?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Delete this {typeConfig[deleteTx.type]?.label || deleteTx.type} entry of <span className="font-bold">Rs. {formatAmount(deleteTx.amount)}</span>? This will automatically update your account balance and any linked khata entry.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTx(null)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Cancel</button>
              <button onClick={handleDeleteTx} disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition inline-flex items-center gap-2">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal (Deposit / Withdraw / Edit) */}
      <AddMoneyTransactionModal
        isOpen={showAddTx}
        onClose={() => { setShowAddTx(false); setEditTx(null); }}
        onSuccess={() => { setShowAddTx(false); setEditTx(null); load(); }}
        preselectedAccountId={accountId}
        editTransaction={editTx}
        defaultType={addTxType}
      />

      {/* Transfer Money Modal */}
      <TransferMoneyModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSuccess={() => { setShowTransfer(false); load(); }}
        preselectedAccountId={accountId}
      />
    </div>
  );
};

export default MoneyAccountDetail;
