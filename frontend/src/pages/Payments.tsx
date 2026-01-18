import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Wallet, Search, User, TrendingDown, TrendingUp, Edit } from 'lucide-react';

interface CustomerPayment {
    customerName: string;
    customerPhone?: string;
    totalCredit: number;
    totalPaid: number;
    outstanding: number;
    lastTransaction: string;
    salesCount: number;
}

const PaymentsPage: React.FC = () => {
    const { sales } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'outstanding' | 'paid'>('all');

    // Adjustment modal state
    const [adjustmentModal, setAdjustmentModal] = useState({
        isOpen: false,
        customerName: '',
        currentOutstanding: 0,
        amount: '',
        notes: ''
    });

    // Aggregate payments by customer
    const customerPayments = useMemo(() => {
        const customersMap = new Map<string, CustomerPayment>();

        sales.forEach(sale => {
            const key = sale.customerName.toLowerCase();

            if (!customersMap.has(key)) {
                customersMap.set(key, {
                    customerName: sale.customerName,
                    customerPhone: sale.customerPhone,
                    totalCredit: 0,
                    totalPaid: 0,
                    outstanding: 0,
                    lastTransaction: sale.date,
                    salesCount: 0
                });
            }

            const customer = customersMap.get(key)!;
            customer.salesCount++;

            if (sale.paymentType === 'Credit') {
                customer.totalCredit += sale.totalAmount;
            } else {
                customer.totalPaid += sale.totalAmount;
            }

            // Update last transaction date
            if (new Date(sale.date) > new Date(customer.lastTransaction)) {
                customer.lastTransaction = sale.date;
            }
        });

        // Calculate outstanding for each customer
        customersMap.forEach(customer => {
            customer.outstanding = customer.totalCredit - customer.totalPaid;
        });

        return Array.from(customersMap.values());
    }, [sales]);

    const filteredCustomers = useMemo(() => {
        return customerPayments.filter(customer => {
            const matchesSearch = customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (customer.customerPhone && customer.customerPhone.includes(searchTerm));

            const matchesFilter =
                filterType === 'all' ||
                (filterType === 'outstanding' && customer.outstanding > 0) ||
                (filterType === 'paid' && customer.outstanding <= 0);

            return matchesSearch && matchesFilter;
        }).sort((a, b) => b.outstanding - a.outstanding);
    }, [customerPayments, searchTerm, filterType]);

    const totalOutstanding = customerPayments.reduce((sum, c) => sum + (c.outstanding > 0 ? c.outstanding : 0), 0);
    const totalPaid = customerPayments.reduce((sum, c) => sum + c.totalPaid, 0);
    const customersWithDebt = customerPayments.filter(c => c.outstanding > 0).length;

    const handleAdjustment = (type: 'received' | 'credit') => {
        if (!adjustmentModal.amount || parseFloat(adjustmentModal.amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const message = type === 'received'
            ? `Customer paid Rs. ${parseFloat(adjustmentModal.amount).toLocaleString()}`
            : `Given additional credit of Rs. ${parseFloat(adjustmentModal.amount).toLocaleString()}`;

        alert(`${message}\n\nThis feature will be fully implemented soon!`);
        setAdjustmentModal({ isOpen: false, customerName: '', currentOutstanding: 0, amount: '', notes: '' });
    };

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                        Customer Payments
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Track credit sales and payment collection
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-8 text-white shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                        <TrendingUp className="w-8 h-8" />
                        <span className="text-sm font-bold uppercase tracking-wider opacity-90">
                            Total Outstanding
                        </span>
                    </div>
                    <div className="text-4xl font-black">Rs. {totalOutstanding.toLocaleString()}</div>
                    <div className="mt-3 text-sm opacity-90">{customersWithDebt} customers with debt</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-8 text-white shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                        <TrendingDown className="w-8 h-8" />
                        <span className="text-sm font-bold uppercase tracking-wider opacity-90">
                            Total Collected
                        </span>
                    </div>
                    <div className="text-4xl font-black">Rs. {totalPaid.toLocaleString()}</div>
                    <div className="mt-3 text-sm opacity-90">All-time payments</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-8 text-white shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                        <User className="w-8 h-8" />
                        <span className="text-sm font-bold uppercase tracking-wider opacity-90">
                            Total Customers
                        </span>
                    </div>
                    <div className="text-4xl font-black">{customerPayments.length}</div>
                    <div className="mt-3 text-sm opacity-90">Active customers</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by customer name or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-medium text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${filterType === 'all'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('outstanding')}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${filterType === 'outstanding'
                                ? 'bg-rose-600 text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                        >
                            Outstanding
                        </button>
                        <button
                            onClick={() => setFilterType('paid')}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${filterType === 'paid'
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                        >
                            Paid
                        </button>
                    </div>
                </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-8 py-6 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-8 py-6 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Phone
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Total Credit
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Total Paid
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Outstanding
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Sales Count
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Last Transaction
                                </th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredCustomers.map((customer, index) => (
                                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                                {customer.customerName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {customer.customerName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-slate-600 dark:text-slate-400 font-medium">
                                        {customer.customerPhone || '-'}
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-rose-600">
                                        Rs. {customer.totalCredit.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-emerald-600">
                                        Rs. {customer.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className={`inline-flex items-center px-4 py-2 rounded-full font-bold text-sm ${customer.outstanding > 0
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            : customer.outstanding < 0
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                            Rs. {Math.abs(customer.outstanding).toLocaleString()}
                                            {customer.outstanding < 0 && ' (Overpaid)'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-900 dark:text-white">
                                        {customer.salesCount}
                                    </td>
                                    <td className="px-8 py-6 text-right text-slate-600 dark:text-slate-400 font-medium">
                                        {new Date(customer.lastTransaction).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={() => setAdjustmentModal({
                                                isOpen: true,
                                                customerName: customer.customerName,
                                                currentOutstanding: customer.outstanding,
                                                amount: '',
                                                notes: ''
                                            })}
                                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                                            title="Adjust Balance"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-24 text-center text-slate-400">
                                        <Wallet className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="text-lg font-bold">No customers found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Adjustment Modal */}
            {adjustmentModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Adjust Balance</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Customer: <span className="font-bold text-slate-900 dark:text-white">{adjustmentModal.customerName}</span>
                        </p>

                        {/* Current Outstanding */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 mb-6">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">Current Outstanding</div>
                            <div className={`text-3xl font-black ${adjustmentModal.currentOutstanding > 0 ? 'text-rose-600' : adjustmentModal.currentOutstanding < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                Rs. {Math.abs(adjustmentModal.currentOutstanding).toLocaleString()}
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="mb-6">
                            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">
                                Amount (PKR)
                            </label>
                            <input
                                type="number"
                                placeholder="Enter amount"
                                value={adjustmentModal.amount}
                                onChange={(e) => setAdjustmentModal({ ...adjustmentModal, amount: e.target.value })}
                                className="w-full px-6 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-bold text-slate-900 dark:text-white text-lg"
                            />
                        </div>

                        {/* Notes */}
                        <div className="mb-6">
                            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">
                                Notes (Optional)
                            </label>
                            <textarea
                                placeholder="Payment details..."
                                rows={2}
                                value={adjustmentModal.notes}
                                onChange={(e) => setAdjustmentModal({ ...adjustmentModal, notes: e.target.value })}
                                className="w-full px-6 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-medium text-slate-900 dark:text-white resize-none"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <button
                                onClick={() => handleAdjustment('received')}
                                disabled={!adjustmentModal.amount || parseFloat(adjustmentModal.amount) <= 0}
                                className="px-6 py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                💰 Received Payment
                            </button>
                            <button
                                onClick={() => handleAdjustment('credit')}
                                disabled={!adjustmentModal.amount || parseFloat(adjustmentModal.amount) <= 0}
                                className="px-6 py-4 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                📝 Add More Credit
                            </button>
                        </div>

                        {/* Cancel Button */}
                        <button
                            onClick={() => setAdjustmentModal({ isOpen: false, customerName: '', currentOutstanding: 0, amount: '', notes: '' })}
                            className="w-full px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentsPage;
