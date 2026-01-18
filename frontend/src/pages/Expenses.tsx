
import React, { useState, useEffect } from 'react';
import { expenseService, Expense, ExpenseCreate } from '../utils/expenseApi';
import { Plus, Calendar, TrendingDown, TrendingUp, Trash2, Edit2, Save, X, FileText } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';

const ExpensesPage: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Use Date object
    const [dailyTotal, setDailyTotal] = useState<number>(0);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expenseType, setExpenseType] = useState<'expense' | 'income'>('expense');

    // Form state - amount is always positive, sign is determined by expenseType
    const [formData, setFormData] = useState({
        name: '',
        amount: 0,
        quantity: 1,
        details: '',
    });

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        expenseId: '',
        expenseName: ''
    });

    useEffect(() => {
        loadExpenses();
        loadDailyTotal();
    }, [selectedDate]);

    const loadExpenses = async () => {
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            const data = await expenseService.getExpenses(dateString);
            setExpenses(data);
        } catch (error) {
            console.error('Failed to load expenses:', error);
        }
    };

    const loadDailyTotal = async () => {
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            const data = await expenseService.getDailyTotal(dateString);
            setDailyTotal(data.total);
        } catch (error) {
            console.error('Failed to load daily total:', error);
            setDailyTotal(0);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // Apply the correct sign based on expense type
            const finalAmount = expenseType === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);

            const dateString = selectedDate.toISOString().split('T')[0];
            await expenseService.createExpense({
                name: formData.name,
                amount: finalAmount,
                quantity: formData.quantity,
                details: formData.details,
                expense_date: dateString
            });

            // Reset form
            setFormData({
                name: '',
                amount: 0,
                quantity: 1,
                details: '',
            });
            setExpenseType('expense');
            setIsAdding(false);
            loadExpenses();
            loadDailyTotal();
        } catch (error) {
            console.error('Failed to create expense:', error);
            alert('Failed to create expense');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            // Apply the correct sign based on expense type
            const finalAmount = expenseType === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);

            await expenseService.updateExpense(id, {
                name: formData.name,
                amount: finalAmount,
                quantity: formData.quantity,
                details: formData.details,
            });
            setEditingId(null);
            setFormData({
                name: '',
                amount: 0,
                quantity: 1,
                details: '',
            });
            setExpenseType('expense');
            loadExpenses();
            loadDailyTotal();
        } catch (error) {
            console.error('Failed to update expense:', error);
            alert('Failed to update expense');
        }
    };

    const confirmDelete = async () => {
        try {
            await expenseService.deleteExpense(confirmDialog.expenseId);
            setConfirmDialog({ isOpen: false, expenseId: '', expenseName: '' });
            loadExpenses();
            loadDailyTotal();
        } catch (error) {
            console.error('Failed to delete expense:', error);
            alert('Failed to delete expense');
        }
    };

    const startEdit = (expense: Expense) => {
        setEditingId(expense.id);
        // Set type based on amount sign
        setExpenseType(expense.amount < 0 ? 'expense' : 'income');
        setFormData({
            name: expense.name,
            amount: Math.abs(expense.amount), // Always show positive in form
            quantity: expense.quantity,
            details: expense.details || '',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({
            name: '',
            amount: 0,
            quantity: 1,
            details: '',
        });
        setExpenseType('expense');
    };

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                    Daily Expenses
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Track your daily expenses and income
                </p>
            </div>

            {/* Date Selector & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Date Selector */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Select Date</h3>
                    </div>
                    <CustomDatePicker
                        selected={selectedDate}
                        onChange={(date) => setSelectedDate(date || new Date())}
                        placeholderText="Select date..."
                        maxDate={new Date()}
                    />
                </div>

                {/* Daily Total */}
                <div className={`bg-gradient-to-br ${dailyTotal >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600'} rounded-3xl p-6 shadow-lg`}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-white/20 rounded-xl">
                            {dailyTotal >= 0 ? (
                                <TrendingUp className="w-6 h-6 text-white" />
                            ) : (
                                <TrendingDown className="w-6 h-6 text-white" />
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white">Daily Total</h3>
                    </div>
                    <p className="text-4xl font-black text-white">
                        {dailyTotal >= 0 ? '+' : ''}{dailyTotal.toLocaleString()} PKR
                    </p>
                    <p className="text-white/80 text-sm mt-2">
                        {dailyTotal >= 0 ? 'Net Income' : 'Net Expense'}
                    </p>
                </div>

                {/* Quick Add Button */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 shadow-lg flex items-center justify-center">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-3 text-white font-bold text-lg hover:scale-105 transition-transform"
                    >
                        <Plus className="w-8 h-8" />
                        <span>Add Expense/Income</span>
                    </button>
                </div>
            </div>

            {/* Add/Edit Form */}
            {(isAdding || editingId) && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg mb-8 border-2 border-purple-200 dark:border-purple-900">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {editingId ? 'Edit Entry' : 'Add New Entry'}
                        </h2>
                        <button
                            onClick={() => {
                                setIsAdding(false);
                                cancelEdit();
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </button>
                    </div>

                    <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleSubmit} className="space-y-6">

                        {/* Type Toggle */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                Type *
                            </label>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setExpenseType('expense')}
                                    className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all ${expenseType === 'expense'
                                        ? 'bg-rose-500 text-white shadow-lg scale-105'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <TrendingDown className="w-5 h-5 inline mr-2" />
                                    Expense (Money Out)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseType('income')}
                                    className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all ${expenseType === 'income'
                                        ? 'bg-emerald-500 text-white shadow-lg scale-105'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <TrendingUp className="w-5 h-5 inline mr-2" />
                                    Income (Money In)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Name/Description *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="e.g., Office Rent, Customer Gift, etc."
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-purple-500 dark:focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Amount - Always Positive */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Amount (PKR) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.amount || ''}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                    required
                                    placeholder="Enter amount"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-purple-500 dark:focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        {/* Details - Full Width */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Additional Details
                            </label>
                            <textarea
                                value={formData.details}
                                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                rows={3}
                                placeholder="Any additional notes..."
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-purple-500 dark:focus:border-purple-500 focus:outline-none transition-colors resize-none"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {editingId ? 'Update Entry' : 'Add Entry'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAdding(false);
                                    cancelEdit();
                                }}
                                className="px-6 py-3 rounded-xl font-bold border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div >
            )}

            {/* Expenses List */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Entries for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
                    </p>
                </div>

                {expenses.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-lg font-semibold">
                            No entries for this date
                        </p>
                        <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
                            Click "Add Expense/Income" to create your first entry
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Amount</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Qty</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Details</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Time</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            {expense.amount < 0 ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                                                    <TrendingDown className="w-4 h-4" />
                                                    Expense
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                                    <TrendingUp className="w-4 h-4" />
                                                    Income
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900 dark:text-white">{expense.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {Math.abs(expense.amount).toLocaleString()} PKR
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{expense.quantity}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm max-w-xs truncate">
                                            {expense.details || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">
                                            {new Date(expense.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => startEdit(expense)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDialog({ isOpen: true, expenseId: expense.id, expenseName: expense.name })}
                                                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Remove Expense Entry"
                message={`Are you sure you want to remove "${confirmDialog.expenseName}"? This will adjust your daily total accordingly.`}
                confirmText="Yes, Remove"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDialog({ isOpen: false, expenseId: '', expenseName: '' })}
                isDangerous={true}
            />
        </div >
    );
};

export default ExpensesPage;
