import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote, Building2, Wallet, TrendingUp, TrendingDown,
  Plus, Edit2, Trash2, Loader2, RefreshCw, ArrowRight, Send
} from 'lucide-react';
import { moneyService, MoneyAccount } from '../utils/moneyApi';
import AddMoneyAccountModal from '../components/AddMoneyAccountModal';
import AddMoneyTransactionModal from '../components/AddMoneyTransactionModal';
import TransferMoneyModal from '../components/TransferMoneyModal';
import { formatAmount } from '../utils/formatters';

const MoneyManagement: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editAccount, setEditAccount] = useState<MoneyAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MoneyAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showAddTx, setShowAddTx] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [txAccount, setTxAccount] = useState<string>('');
  const [txType, setTxType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await moneyService.getAccounts();
      setAccounts(data);
    } catch (e: any) {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteConfirm || isDeleting) return;
    try {
      setIsDeleting(true);
      await moneyService.deleteAccount(deleteConfirm.id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Cannot delete this account');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeposit = (accountId: string) => {
    setTxAccount(accountId);
    setTxType('DEPOSIT');
    setShowAddTx(true);
  };

  const openWithdrawal = (accountId: string) => {
    setTxAccount(accountId);
    setTxType('WITHDRAWAL');
    setShowAddTx(true);
  };

  const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);
  const bankBalance = accounts.filter(a => a.account_type === 'BANK').reduce((s, a) => s + (a.current_balance || 0), 0);
  const cashBalance = accounts.filter(a => a.account_type === 'CASH').reduce((s, a) => s + (a.current_balance || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Money Management</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Track your bank accounts and cash flow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setTxAccount(accounts[0]?.id || ''); setShowTransfer(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-lg transition">
            <Send className="w-4 h-4" /> Transfer
          </button>
          <button onClick={() => setShowAddAccount(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg transition">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Balance</p>
          <p className={`text-3xl font-black mt-1 ${totalBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
            Rs. {formatAmount(totalBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bank Accounts</p>
          <p className={`text-3xl font-black mt-1 ${bankBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            Rs. {formatAmount(bankBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{accounts.filter(a => a.account_type === 'BANK').length} bank account{accounts.filter(a => a.account_type === 'BANK').length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cash / Counter</p>
          <p className={`text-3xl font-black mt-1 ${cashBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            Rs. {formatAmount(cashBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{accounts.filter(a => a.account_type === 'CASH').length} cash account{accounts.filter(a => a.account_type === 'CASH').length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}
      {!loading && error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 font-medium">{error}</div>
      )}
      {!loading && !error && accounts.length === 0 && (
        <div className="text-center py-20">
          <Banknote className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">No accounts yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">Add your UBL bank account or shop counter cash to start tracking</p>
          <button onClick={() => setShowAddAccount(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition">
            <Plus className="w-5 h-5" /> Add First Account
          </button>
        </div>
      )}

      {/* Account Cards */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
              {/* Card Header */}
              <div className={`px-5 py-4 ${acc.account_type === 'BANK' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      {acc.account_type === 'BANK' ? <Building2 className="w-4 h-4 text-white" /> : <Wallet className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm leading-tight">{acc.title}</p>
                      <p className="text-white/70 text-xs">{acc.bank_name || acc.account_type}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] text-white font-bold uppercase tracking-wider">
                    {acc.account_type === 'BANK' ? 'Bank' : 'Cash'}
                  </span>
                </div>
              </div>

              {/* Balance */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Current Balance</p>
                <p className={`text-4xl font-black mt-1 ${acc.current_balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                  Rs. {formatAmount(acc.current_balance)}
                </p>
                {acc.account_number && (
                  <p className="text-xs text-slate-400 mt-1 font-mono">{acc.account_number}</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60">
                <button onClick={() => openDeposit(acc.id)}
                  className="flex-1 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 rounded-lg flex items-center justify-center gap-1 transition">
                  <TrendingUp className="w-3.5 h-3.5" /> Deposit
                </button>
                <button onClick={() => openWithdrawal(acc.id)}
                  className="flex-1 py-1.5 text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg flex items-center justify-center gap-1 transition">
                  <TrendingDown className="w-3.5 h-3.5" /> Withdraw
                </button>
                <button onClick={() => { setTxAccount(acc.id); setShowTransfer(true); }}
                  className="flex-1 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 rounded-lg flex items-center justify-center gap-1 transition">
                  <Send className="w-3.5 h-3.5" /> Transfer
                </button>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditAccount(acc); setShowAddAccount(true); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition" title="Edit account">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(acc)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="Delete account">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => navigate(`/money/${acc.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition">
                  View Ledger <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Delete <span className="font-bold text-gray-900 dark:text-white">{deleteConfirm.title}</span>? This is only allowed if there are no transactions (other than opening balance).
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition inline-flex items-center gap-2">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddMoneyAccountModal
        isOpen={showAddAccount}
        onClose={() => { setShowAddAccount(false); setEditAccount(null); }}
        onSuccess={() => { setShowAddAccount(false); setEditAccount(null); load(); }}
        editAccount={editAccount}
      />
      <AddMoneyTransactionModal
        isOpen={showAddTx}
        onClose={() => setShowAddTx(false)}
        onSuccess={() => { setShowAddTx(false); load(); }}
        preselectedAccountId={txAccount}
        defaultType={txType}
      />
      <TransferMoneyModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        onSuccess={() => { setShowTransfer(false); load(); }}
        preselectedAccountId={txAccount}
      />
    </div>
  );
};

export default MoneyManagement;
