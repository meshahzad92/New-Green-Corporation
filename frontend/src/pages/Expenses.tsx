import React, { useState, useEffect, useMemo } from 'react';
import { expenseService, Expense } from '../utils/expenseApi';
import { 
  Plus, Calendar, TrendingDown, TrendingUp, Trash2, Edit2, 
  Save, X, FileText, Search, ChevronLeft, ChevronRight, 
  Sparkles, DollarSign, Wallet, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatDate, formatAmount, toISODateString } from '../utils/formatters';

const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'date' | 'all'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Add / Edit Modal / Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenseType, setExpenseType] = useState<'expense' | 'income'>('expense');
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    name: '',
    amount: '' as number | '',
    quantity: 1,
    details: '',
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    expenseId: '',
    expenseName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      if (viewMode === 'date') {
        const dateString = toISODateString(selectedDate);
        const data = await expenseService.getExpenses({ expense_date: dateString });
        setExpenses(data);
      } else {
        const data = await expenseService.getExpenses({ limit: 1000 });
        setExpenses(data);
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedDate, viewMode]);

  // Listen for global expense updates (from sidebar / floating quick add button)
  useEffect(() => {
    const handleGlobalUpdate = () => {
      loadExpenses();
    };
    window.addEventListener('expense-updated', handleGlobalUpdate);
    return () => window.removeEventListener('expense-updated', handleGlobalUpdate);
  }, [selectedDate, viewMode]);

  // Quick Date Navigation Helpers
  const goToToday = () => {
    setSelectedDate(new Date());
    setViewMode('date');
  };

  const goToYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setSelectedDate(y);
    setViewMode('date');
  };

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setViewMode('date');
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setViewMode('date');
  };

  // Financial calculations
  const totalExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [expenses]);

  const totalIncome = useMemo(() => {
    return expenses
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const netTotal = useMemo(() => {
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses]);

  // Filtered expenses based on search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter((e) => {
      const nameMatch = e.name.toLowerCase().includes(q);
      const detailsMatch = e.details?.toLowerCase().includes(q);
      const amountMatch = Math.abs(e.amount).toString().includes(q);
      const dateMatch = formatDate(e.expense_date || e.created_at).includes(q);
      return nameMatch || detailsMatch || amountMatch || dateMatch;
    });
  }, [expenses, searchQuery]);

  // Open Form for Adding
  const startAdd = () => {
    setEditingId(null);
    setExpenseType('expense');
    setFormDate(viewMode === 'date' ? selectedDate : new Date());
    setFormData({
      name: '',
      amount: '',
      quantity: 1,
      details: '',
    });
    setIsAdding(true);
  };

  // Open Form for Editing
  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setExpenseType(expense.amount < 0 ? 'expense' : 'income');
    setFormDate(expense.expense_date ? new Date(expense.expense_date) : new Date(expense.created_at));
    setFormData({
      name: expense.name,
      amount: Math.abs(expense.amount),
      quantity: expense.quantity || 1,
      details: expense.details || '',
    });
    setIsAdding(true);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      amount: '',
      quantity: 1,
      details: '',
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numAmount = typeof formData.amount === 'number' ? formData.amount : parseFloat(formData.amount);
    if (!formData.name.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid description and positive amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalAmount = expenseType === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);
      const dateString = toISODateString(formDate);

      if (editingId) {
        await expenseService.updateExpense(editingId, {
          name: formData.name.trim(),
          amount: finalAmount,
          quantity: formData.quantity,
          details: formData.details ? formData.details.trim() : '',
          expense_date: dateString,
        });
      } else {
        await expenseService.createExpense({
          name: formData.name.trim(),
          amount: finalAmount,
          quantity: formData.quantity,
          details: formData.details ? formData.details.trim() : '',
          expense_date: dateString,
        });
      }

      // Notify other pages
      window.dispatchEvent(new CustomEvent('expense-updated'));

      cancelForm();
      await loadExpenses();
    } catch (error) {
      console.error('Failed to save expense:', error);
      alert('Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await expenseService.deleteExpense(confirmDialog.expenseId);
      setConfirmDialog({ isOpen: false, expenseId: '', expenseName: '' });
      window.dispatchEvent(new CustomEvent('expense-updated'));
      await loadExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert('Failed to delete expense');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Shop Expenses & Income
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track daily shop outlays, operational costs, carriage, and income anytime, for any date
          </p>
        </div>

        <button
          onClick={startAdd}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-extrabold rounded-2xl shadow-xl shadow-purple-600/25 transition-all hover:scale-[1.02] active:scale-95 text-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Add Expense / Income</span>
        </button>
      </div>

      {/* Date Navigation & Period Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Quick Date Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day Steppers */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-2xl p-1 border border-slate-200 dark:border-slate-600/50">
            <button
              onClick={goToPrevDay}
              title="Previous Day"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-purple-600 shadow-sm transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextDay}
              title="Next Day"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-purple-600 shadow-sm transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Today Button */}
          <button
            onClick={goToToday}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'date' && toISODateString(selectedDate) === toISODateString(new Date())
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            📅 Today
          </button>

          {/* Yesterday Button */}
          <button
            onClick={goToYesterday}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'date' &&
              toISODateString(selectedDate) ===
                toISODateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ⏮️ Yesterday
          </button>

          {/* All History Button */}
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            🌐 All History
          </button>
        </div>

        {/* Date Picker + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Custom Date Picker (Any Date) */}
          <div className="w-full sm:w-52">
            <CustomDatePicker
              selected={viewMode === 'date' ? selectedDate : null}
              onChange={(d) => {
                if (d) {
                  setSelectedDate(d);
                  setViewMode('date');
                }
              }}
              placeholderText="Pick any date..."
            />
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Outflow / Expenses */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              {viewMode === 'date' ? 'Daily Expenses (Out)' : 'Total Expenses (Out)'}
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              Rs. {formatAmount(totalExpenses)}
            </div>
            <span className="text-[11px] font-semibold text-rose-500/80 flex items-center gap-1 mt-1">
              <ArrowDownRight className="w-3.5 h-3.5" /> Money Paid Out
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <TrendingDown className="w-7 h-7" />
          </div>
        </div>

        {/* Inflow / Income */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              {viewMode === 'date' ? 'Daily Income (In)' : 'Total Income (In)'}
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              Rs. {formatAmount(totalIncome)}
            </div>
            <span className="text-[11px] font-semibold text-emerald-500/80 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Gifts / Reimbursements
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>

        {/* Net Flow */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Net Financial Flow
            </span>
            <div
              className={`text-2xl font-black mt-1 ${
                netTotal >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netTotal >= 0 ? '+' : '-'}Rs. {formatAmount(Math.abs(netTotal))}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-1">
              <Wallet className="w-3.5 h-3.5" />
              {netTotal >= 0 ? 'Net Positive Inflow' : 'Net Operational Outflow'}
            </span>
          </div>
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              netTotal >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            <DollarSign className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Add / Edit Inline Modal / Card */}
      {isAdding && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border-2 border-purple-400/40 dark:border-purple-600/40 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {editingId ? 'Edit Expense Entry' : 'Record New Expense / Income'}
                </h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Specify date, description, and amount
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelForm}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Type Toggle & Date Picker Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Transaction Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpenseType('expense')}
                    className={`py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      expenseType === 'expense'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-500/50'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>Expense (Outflow)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType('income')}
                    className={`py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      expenseType === 'income'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/50'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Income (Inflow)</span>
                  </button>
                </div>
              </div>

              {/* Expense Date Picker (Any Date) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span>Expense Date * (Any Previous or Today's Date)</span>
                </label>
                <CustomDatePicker
                  selected={formDate}
                  onChange={(d) => setFormDate(d || new Date())}
                  placeholderText="Pick date..."
                />
              </div>
            </div>

            {/* Name & Amount */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Name / Description *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Shop tea, Freight, Rent, Diesel..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Amount (PKR) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amount: e.target.value === '' ? '' : parseFloat(e.target.value),
                      })
                    }
                    required
                    placeholder="0.00"
                    className="w-full pl-4 pr-12 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-base focus:border-purple-500 focus:outline-none transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    PKR
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity & Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Details (Optional)
                </label>
                <input
                  type="text"
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Additional notes, payee name, or remarks..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={cancelForm}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-2xl font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Entry...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingId ? 'Update Entry' : 'Save Entry'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        {/* Table Title Bar */}
        <div className="p-6 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {viewMode === 'date' ? (
                <>
                  Entries for {formatDate(selectedDate)}{' '}
                  <span className="text-xs font-semibold text-slate-400 ml-1">
                    ({selectedDate.toLocaleDateString('en-US', { weekday: 'long' })})
                  </span>
                </>
              ) : (
                'All Recorded Expenses & Income'
              )}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Showing {filteredExpenses.length}{' '}
              {filteredExpenses.length === 1 ? 'record' : 'records'}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <FileText className="w-10 h-10" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-base font-bold">
              No entries found {viewMode === 'date' ? `for ${formatDate(selectedDate)}` : ''}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Click "Add Expense / Income" or use the quick buttons above to navigate
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Name / Description
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Qty
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Details
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Logged Time
                  </th>
                  <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredExpenses.map((expense) => {
                  const isExpense = expense.amount < 0;
                  const absAmt = Math.abs(expense.amount);
                  const entryDate = expense.expense_date || expense.created_at;

                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                          {formatDate(entryDate)}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isExpense ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40">
                            <TrendingDown className="w-3 h-3" />
                            Expense
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                            <TrendingUp className="w-3 h-3" />
                            Income
                          </span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {expense.name}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-black ${
                            isExpense
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}Rs. {formatAmount(absAmt)}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 text-center font-bold text-xs text-slate-600 dark:text-slate-400">
                        {expense.quantity || 1}
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {expense.details || '—'}
                      </td>

                      {/* Logged Time */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-400 whitespace-nowrap">
                        {new Date(expense.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(expense)}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
                            title="Edit Entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                expenseId: expense.id,
                                expenseName: expense.name,
                              })
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Remove Expense Entry"
        message={`Are you sure you want to remove "${confirmDialog.expenseName}"? This will adjust your financial totals accordingly.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, expenseId: '', expenseName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default ExpensesPage;
