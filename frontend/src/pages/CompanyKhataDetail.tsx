import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Banknote,
  Package,
  CreditCard,
  Wallet,
  Printer,
  Trash2,
  Pencil,
  Loader2,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Search,
  FileText
} from 'lucide-react';
import {
  companyKhataService,
  CompanyKhataLedger,
  CompanyKhataEntry
} from '../utils/companyKhataApi';
import { useData } from '../context/DataContext';
import ConfirmDialog from '../components/ConfirmDialog';
import CompanyPaymentModal from '../components/CompanyPaymentModal';
import CompanyPurchaseModal from '../components/CompanyPurchaseModal';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatDate, formatAmount } from '../utils/formatters';

const CompanyKhataDetail: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { refreshData, products } = useData();

  const [ledgerData, setLedgerData] = useState<CompanyKhataLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'PAYMENT' | 'PURCHASE'>('all');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // Edit Entry Modal
  const [editingEntry, setEditingEntry] = useState<CompanyKhataEntry | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'ONLINE'>('ONLINE');
  const [editBankName, setEditBankName] = useState('');
  const [editTxId, setEditTxId] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Entry Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    entry?: CompanyKhataEntry;
  }>({
    isOpen: false,
    entry: undefined
  });

  useEffect(() => {
    if (companyId) {
      loadLedger();
    }
  }, [companyId]);

  const loadLedger = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await companyKhataService.getLedger(companyId);
      setLedgerData(data);
    } catch (err) {
      console.error('Failed to load company ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!ledgerData) return [];
    return ledgerData.entries.filter(entry => {
      if (typeFilter !== 'all' && entry.entry_type !== typeFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      // Check remarks
      if (entry.remarks && entry.remarks.toLowerCase().includes(term)) return true;
      // Check bank
      if (entry.bank_name && entry.bank_name.toLowerCase().includes(term)) return true;
      // Check txId
      if (entry.transaction_id && entry.transaction_id.toLowerCase().includes(term)) return true;
      // Check products
      if (entry.products_detail && Array.isArray(entry.products_detail)) {
        const matchProd = entry.products_detail.some(item =>
          item.name && item.name.toLowerCase().includes(term)
        );
        if (matchProd) return true;
      }
      return false;
    });
  }, [ledgerData, typeFilter, searchTerm]);

  // Handle Edit Opening
  const handleOpenEdit = (entry: CompanyKhataEntry) => {
    setEditingEntry(entry);
    setEditDate(new Date(entry.entry_date));
    setEditAmountPaid(entry.amount_paid ? entry.amount_paid.toString() : '');
    setEditPaymentMethod((entry.payment_method as any) || 'ONLINE');
    setEditBankName(entry.bank_name || '');
    setEditTxId(entry.transaction_id || '');
    setEditRemarks(entry.remarks || '');
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
      const updates: any = {
        entry_date: editDate.toISOString(),
        remarks: editRemarks.trim() || undefined
      };

      if (editingEntry.entry_type === 'PAYMENT') {
        const amt = parseFloat(editAmountPaid);
        if (amt && amt > 0) {
          updates.amount_paid = amt;
        }
        updates.payment_method = editPaymentMethod;
        updates.bank_name = editPaymentMethod === 'ONLINE' ? editBankName.trim() : undefined;
        updates.transaction_id = editPaymentMethod === 'ONLINE' ? editTxId.trim() : undefined;
      }

      await companyKhataService.updateEntry(editingEntry.id, updates);
      setEditingEntry(null);
      await Promise.all([loadLedger(), refreshData()]);
    } catch (err) {
      console.error('Failed to update entry:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Entry
  const handleConfirmDelete = async () => {
    if (!deleteDialog.entry) return;
    try {
      await companyKhataService.deleteEntry(deleteDialog.entry.id);
      setDeleteDialog({ isOpen: false, entry: undefined });
      await Promise.all([loadLedger(), refreshData()]);
    } catch (err) {
      console.error('Failed to delete company entry:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Company Ledger...</p>
      </div>
    );
  }

  if (!ledgerData) {
    return (
      <div className="p-16 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-base font-black text-slate-900 dark:text-white">Company Not Found</p>
        <button
          onClick={() => navigate('/company-khata')}
          className="mt-4 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
        >
          Back to Company Khata
        </button>
      </div>
    );
  }

  const isAdvance = ledgerData.net_balance > 0;
  const isPayable = ledgerData.net_balance < 0;
  const isSettled = ledgerData.net_balance === 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/company-khata')}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Back to Company Khata"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-base shadow-sm">
              {ledgerData.company_logo ? (
                <img src={`/logos/${ledgerData.company_logo}`} alt={ledgerData.company_name} className="w-full h-full object-contain p-1 rounded-2xl" />
              ) : (
                ledgerData.company_name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {ledgerData.company_name}
              </h1>
              <p className="text-xs font-bold text-slate-400">
                Supplier Ledger & Statement
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all text-xs"
          >
            <Banknote className="w-4 h-4 stroke-[2.5px]" />
            PAY COMPANY
          </button>
          <button
            onClick={() => setIsPurchaseModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all text-xs"
          >
            <Package className="w-4 h-4 stroke-[2.5px]" />
            RECEIVE STOCK
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 font-bold transition text-xs"
            title="Print Statement"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Printable Company Banner (Visible in Print Mode) */}
      <div className="hidden print:block p-4 border-b border-slate-300 mb-6">
        <h1 className="text-2xl font-black">{ledgerData.company_name} - Ledger Statement</h1>
        <p className="text-sm text-slate-600">Printed on {formatDate(new Date())}</p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 print:grid-cols-3">
        {/* Total Paid Out */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
              Total Amount Paid
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
              Rs. {(Number(ledgerData.total_paid) || formatAmount(0))}
            </h3>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-bold mt-1">
              Advances & bank payments
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 print:hidden">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Stock Received */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
              Total Stock Received
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300">
              Rs. {(Number(ledgerData.total_purchased) || formatAmount(0))}
            </h3>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-bold mt-1">
              Inward bill value
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 print:hidden">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Net Running Balance Position */}
        {isAdvance && (
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-xl shadow-emerald-600/20 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">
                Advance Balance with Company
              </p>
              <h3 className="text-2xl sm:text-3xl font-black">
                Rs. {(Number(ledgerData.net_balance) || formatAmount(0))}
              </h3>
              <p className="text-xs text-emerald-100 font-bold mt-1">
                Our money available with company
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white print:hidden">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        )}

        {isPayable && (
          <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-6 rounded-3xl shadow-xl shadow-rose-600/20 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-1">
                Payable Dues to Company
              </p>
              <h3 className="text-2xl sm:text-3xl font-black">
                Rs. {formatAmount(Math.abs(Number(ledgerData.net_balance) || 0))}

              </h3>
              <p className="text-xs text-rose-100 font-bold mt-1">
                Pending dues for received stock
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white print:hidden">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        )}

        {isSettled && (
          <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Ledger Balance
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200">
                Settled (Rs. 0)
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">No dues or advances</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 print:hidden">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, bank, remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
              typeFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Logs ({ledgerData.entries.length})
          </button>
          <button
            onClick={() => setTypeFilter('PAYMENT')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
              typeFilter === 'PAYMENT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Payments ({ledgerData.entries.filter(e => e.entry_type === 'PAYMENT').length})
          </button>
          <button
            onClick={() => setTypeFilter('PURCHASE')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
              typeFilter === 'PURCHASE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Stock Purchases ({ledgerData.entries.filter(e => e.entry_type === 'PURCHASE').length})
          </button>
        </div>
      </div>

      {/* Chronological Statement Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30">
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Entry Type</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction Details</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Paid to Co.</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Stock Received</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Running Balance</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold text-xs">
                    No transactions recorded for this company
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isPayment = entry.entry_type === 'PAYMENT';
                  const isPurchase = entry.entry_type === 'PURCHASE';
                  const runBal = entry.running_balance ?? 0;
                  const runBalIsAdvance = runBal > 0;
                  const runBalIsPayable = runBal < 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition">
                      {/* Date */}
                      <td className="py-4 px-6 font-bold text-xs text-slate-900 dark:text-white whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>

                      {/* Type Badge */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isPayment ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <Banknote className="w-3.5 h-3.5" />
                            PAYMENT OUT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                            <Package className="w-3.5 h-3.5" />
                            STOCK INWARD
                          </span>
                        )}
                      </td>

                      {/* Transaction Details */}
                      <td className="py-4 px-6">
                        {isPayment && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                                {entry.payment_method || 'ONLINE'}
                              </span>
                              {entry.bank_name && (
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {entry.bank_name}
                                </span>
                              )}
                              {entry.transaction_id && (
                                <span className="text-slate-400 font-mono text-[11px]">
                                  (Ref: {entry.transaction_id})
                                </span>
                              )}
                            </div>
                            {entry.remarks && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                "{entry.remarks}"
                              </p>
                            )}
                          </div>
                        )}

                        {isPurchase && (
                          <div className="space-y-1.5">
                            {entry.products_detail && Array.isArray(entry.products_detail) && entry.products_detail.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {entry.products_detail.map((item, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg text-xs"
                                  >
                                    <span className="font-black text-slate-800 dark:text-slate-200">
                                      {item.name || 'Product'}
                                    </span>
                                    <span className="text-slate-500 font-bold">
                                      × {item.quantity} units
                                    </span>
                                    {item.unit_price && (
                                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                                        (@ Rs. {formatAmount(Number(item.unit_price))})
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      = Rs. {formatAmount(Number(item.total_price))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Inward delivery items</span>
                            )}
                            {entry.remarks && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                Note: {entry.remarks}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Paid to Co. (Debit/Out) */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {isPayment ? (
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                            Rs. {formatAmount(entry.amount_paid)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                        )}
                      </td>

                      {/* Stock Received (Credit/In) */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {isPurchase ? (
                          <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                            Rs. {formatAmount(entry.total_purchase_amount)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="py-4 px-6 text-right whitespace-nowrap font-black text-sm">
                        {runBalIsAdvance && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            + Advance: Rs. {formatAmount(runBal)}
                          </span>
                        )}
                        {runBalIsPayable && (
                          <span className="text-rose-600 dark:text-rose-400">
                            - Payable: Rs. {formatAmount(Math.abs(runBal))}
                          </span>
                        )}
                        {!runBalIsAdvance && !runBalIsPayable && (
                          <span className="text-slate-400">Rs. 0</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(entry)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                            title="Edit Entry"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ isOpen: true, entry })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit {editingEntry.entry_type === 'PAYMENT' ? 'Payment Entry' : 'Stock Purchase Note'}
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Entry Date
                </label>
                <CustomDatePicker
                  selected={editDate}
                  onChange={(date) => date && setEditDate(date)}
                  maxDate={new Date()}
                />
              </div>

              {editingEntry.entry_type === 'PAYMENT' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditPaymentMethod('ONLINE')}
                        className={`py-2 text-xs font-bold rounded-lg border ${
                          editPaymentMethod === 'ONLINE'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'
                        }`}
                      >
                        Online
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPaymentMethod('CASH')}
                        className={`py-2 text-xs font-bold rounded-lg border ${
                          editPaymentMethod === 'CASH'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'
                        }`}
                      >
                        Cash
                      </button>
                    </div>
                  </div>

                  {editPaymentMethod === 'ONLINE' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                          placeholder="e.g. Meezan Bank"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                          Transaction ID / Ref #
                        </label>
                        <input
                          type="text"
                          value={editTxId}
                          onChange={(e) => setEditTxId(e.target.value)}
                          placeholder="e.g. TXN-12345"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Amount Paid (Rs.)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={editAmountPaid}
                      onChange={(e) => setEditAmountPaid(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Company Entry?"
        message={
          deleteDialog.entry?.entry_type === 'PURCHASE'
            ? 'Warning: Deleting this inward stock purchase will automatically reverse the added inventory stock and restore the previous product purchase cost.'
            : 'Are you sure you want to delete this payment record? This will adjust the company running ledger balance.'
        }
        confirmText="Yes, Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, entry: undefined })}
      />

      {/* Payment & Purchase Modals */}
      <CompanyPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          loadLedger();
          refreshData();
        }}
        preselectedCompanyId={companyId}
        companiesList={ledgerData ? [{
          account_id: ledgerData.account_id,
          company_id: ledgerData.company_id,
          name: ledgerData.name,
          company_name: ledgerData.company_name,
          phone: ledgerData.phone,
          catalog_company_id: ledgerData.catalog_company_id,
          catalog_company_name: ledgerData.catalog_company_name,
          company_logo: ledgerData.company_logo,
          total_paid: ledgerData.total_paid,
          total_purchased: ledgerData.total_purchased,
          net_balance: ledgerData.net_balance,
          balance_status: ledgerData.balance_status,
          entry_count: ledgerData.entries.length,
          products_count: 0
        }] : []}
      />

      <CompanyPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={() => {
          loadLedger();
          refreshData();
        }}
        preselectedCompanyId={companyId}
        companiesList={ledgerData ? [{
          account_id: ledgerData.account_id,
          company_id: ledgerData.company_id,
          name: ledgerData.name,
          company_name: ledgerData.company_name,
          phone: ledgerData.phone,
          catalog_company_id: ledgerData.catalog_company_id,
          catalog_company_name: ledgerData.catalog_company_name,
          company_logo: ledgerData.company_logo,
          total_paid: ledgerData.total_paid,
          total_purchased: ledgerData.total_purchased,
          net_balance: ledgerData.net_balance,
          balance_status: ledgerData.balance_status,
          entry_count: ledgerData.entries.length,
          products_count: 0
        }] : []}
      />
    </div>
  );
};

export default CompanyKhataDetail;
