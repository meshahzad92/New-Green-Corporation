import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Wallet, 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  Pencil, 
  Loader2, 
  AlertCircle,
  Calendar,
  User,
  Package,
  Phone,
  FileText,
  Banknote,
  Landmark
} from 'lucide-react';
import { khataService, KhataAccount, KhataEntry } from '../utils/khataApi';
import { useData } from '../context/DataContext';
import ConfirmDialog from '../components/ConfirmDialog';
import CreditSaleModal from '../components/CreditSaleModal';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatDate } from '../utils/formatters';

const KhataDetail: React.FC = () => {
  const { dealerId } = useParams<{ dealerId: string }>();
  const navigate = useNavigate();
  const { refreshData } = useData();

  const [dealer, setDealer] = useState<KhataAccount | null>(null);
  const [ledger, setLedger] = useState<KhataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'CREDIT' | 'RECOVERY'>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'credit' | 'recovery'>('credit');

  // Edit Entry Modal
  const [editingEntry, setEditingEntry] = useState<KhataEntry | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editFarmer, setEditFarmer] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [editBankName, setEditBankName] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Entry Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    entryId?: string;
  }>({
    isOpen: false,
    entryId: undefined
  });

  useEffect(() => {
    if (dealerId) {
      loadData();
    }
  }, [dealerId]);

  const loadData = async () => {
    if (!dealerId) return;
    setLoading(true);
    try {
      const [dData, lData] = await Promise.all([
        khataService.getDealer(dealerId),
        khataService.getDealerLedger(dealerId)
      ]);
      setDealer(dData);
      setLedger(lData);
    } catch (err) {
      console.error('Failed to load dealer ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (entry: KhataEntry) => {
    setEditingEntry(entry);
    setEditDate(new Date(entry.entry_date));
    setEditFarmer(entry.farmer_name || '');
    setEditAmount(entry.entry_type === 'CREDIT' ? entry.credit_amount.toString() : entry.recovery_amount.toString());
    setEditPaymentMethod(entry.payment_method || 'CASH');
    setEditBankName(entry.bank_name || '');
    setEditRemarks(entry.remarks || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
      const amt = parseFloat(editAmount) || 0;
      await khataService.updateEntry(editingEntry.id, {
        entry_date: editDate.toISOString(),
        farmer_name: editingEntry.entry_type === 'CREDIT' ? editFarmer.trim() : undefined,
        credit_amount: editingEntry.entry_type === 'CREDIT' ? amt : undefined,
        recovery_amount: editingEntry.entry_type === 'RECOVERY' ? amt : undefined,
        payment_method: editingEntry.entry_type === 'RECOVERY' ? editPaymentMethod : undefined,
        bank_name: editingEntry.entry_type === 'RECOVERY' && editPaymentMethod === 'ONLINE' ? editBankName.trim() : undefined,
        remarks: editRemarks.trim() || undefined
      });
      setEditingEntry(null);
      await Promise.all([loadData(), refreshData()]);
    } catch (err) {
      console.error('Failed to update entry:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteDialog.entryId) return;
    try {
      await khataService.deleteEntry(deleteDialog.entryId);
      setDeleteDialog({ isOpen: false, entryId: undefined });
      await Promise.all([loadData(), refreshData()]);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      const matchSearch = (entry.farmer_name && entry.farmer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.remarks && entry.remarks.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.products_detail && entry.products_detail.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())));

      if (!matchSearch && searchTerm) return false;

      if (typeFilter !== 'all') {
        return entry.entry_type === typeFilter;
      }
      return true;
    });
  }, [ledger, searchTerm, typeFilter]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-32 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-rose-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-400">Loading Dealer Ledger...</p>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="py-24 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dealer Not Found</h2>
        <button
          onClick={() => navigate('/khata')}
          className="mt-4 px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
        >
          Back to Khata
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20 print:p-0 print:space-y-4">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/khata')}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {dealer.name}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                {dealer.role || 'Dealer'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold flex items-center gap-2 mt-1">
              {dealer.phone && (
                <span className="flex items-center gap-1 text-blue-500">
                  <Phone className="w-3 h-3" /> {dealer.phone}
                </span>
              )}
              <span>• Account Active since {formatDate(dealer.created_at)}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setModalMode('credit');
              setModalOpen(true);
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            + CREDIT SALE
          </button>
          <button
            onClick={() => {
              setModalMode('recovery');
              setModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Wallet className="w-4 h-4" />
            + ADD RECOVERY
          </button>
          <button
            onClick={handlePrint}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            PRINT STATEMENT
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Credit */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Total Credit Given
          </span>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
            Rs. {dealer.total_credit.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-400 font-bold mt-1">Cumulative spray taken</p>
        </div>

        {/* Total Recovery */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Total Recovery Received
          </span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            Rs. {dealer.total_recovery.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-400 font-bold mt-1">Cumulative cash paid</p>
        </div>

        {/* Total Amount Left (Balance) */}
        <div className={`p-6 rounded-3xl shadow-lg border ${
          dealer.total_left > 0
            ? 'bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-rose-600/20 border-transparent'
            : 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-emerald-600/20 border-transparent'
        }`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80 block mb-1">
            Total Amount Left
          </span>
          <h3 className="text-3xl font-black">
            Rs. {dealer.total_left.toLocaleString()}
          </h3>
          <p className="text-xs text-white/80 font-bold mt-1">
            {dealer.total_left > 0 ? 'Outstanding Market Dues' : '✓ Fully Settled (Zero Dues)'}
          </p>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        
        {/* Search & Filter Toolbar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search farmer or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
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
              All Logs ({ledger.length})
            </button>
            <button
              onClick={() => setTypeFilter('CREDIT')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
                typeFilter === 'CREDIT'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Credit Only
            </button>
            <button
              onClick={() => setTypeFilter('RECOVERY')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
                typeFilter === 'RECOVERY'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              Recoveries Only
            </button>
          </div>
        </div>

        {/* Chronological Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Farmer / Next Customer</th>
                <th className="px-6 py-4">Products Taken</th>
                <th className="px-6 py-4 text-right text-rose-500">Credit (+Rs.)</th>
                <th className="px-6 py-4 text-right text-emerald-500">Recovery (-Rs.)</th>
                <th className="px-6 py-4 text-right">Amount Left (Balance)</th>
                <th className="px-6 py-4 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {filteredLedger.map((entry) => {
                const isCredit = entry.entry_type === 'CREDIT';

                return (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    {/* Date */}
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(entry.entry_date)}
                    </td>

                    {/* Entry Type Badge */}
                    <td className="px-6 py-4">
                      {isCredit ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          Credit
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                          <Wallet className="w-3 h-3" />
                          Recovery
                        </span>
                      )}
                    </td>

                    {/* Farmer / Payment Channel */}
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {isCredit ? (
                        entry.farmer_name ? (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{entry.farmer_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium italic">Direct Credit</span>
                        )
                      ) : (
                        /* Recovery Entry */
                        <div className="space-y-1">
                          {entry.payment_method === 'ONLINE' ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                              <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Online {entry.bank_name ? `• ${entry.bank_name}` : 'Transfer'}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Cash Handover</span>
                            </div>
                          )}
                        </div>
                      )}
                      {entry.remarks && (
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                          Note: {entry.remarks}
                        </p>
                      )}
                    </td>

                    {/* Products Detail */}
                    <td className="px-6 py-4">
                      {entry.products_detail && entry.products_detail.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {entry.products_detail.map((prod, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                            >
                              {prod.name} ({prod.quantity} × Rs.{prod.price})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Credit Amount (+Rs.) */}
                    <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">
                      {isCredit && entry.credit_amount > 0 ? `+Rs. ${entry.credit_amount.toLocaleString()}` : '—'}
                    </td>

                    {/* Recovery Amount (-Rs.) */}
                    <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {!isCredit && entry.recovery_amount > 0 ? `-Rs. ${entry.recovery_amount.toLocaleString()}` : '—'}
                    </td>

                    {/* Running Balance (Total Amount Left) */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-xl">
                        Rs. {(entry.running_balance ?? 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-6 py-4 text-right print:hidden">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Edit Entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ isOpen: true, entryId: entry.id })}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-bold">No transactions found for this dealer.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Sale & Recovery Modal */}
      <CreditSaleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          loadData();
        }}
        initialDealerId={dealer.id}
        defaultMode={modalMode}
      />

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Edit {editingEntry.entry_type === 'CREDIT' ? 'Credit Entry' : 'Recovery Entry'}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Update date, amount, or remarks for this record
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Date
                </label>
                <CustomDatePicker
                  selected={editDate}
                  onChange={(d) => setEditDate(d || new Date())}
                  placeholderText="Select date..."
                />
              </div>

              {editingEntry.entry_type === 'CREDIT' && (
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Farmer Name
                  </label>
                  <input
                    type="text"
                    value={editFarmer}
                    onChange={(e) => setEditFarmer(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {editingEntry.entry_type === 'CREDIT' ? 'Credit Amount (Rs.)' : 'Recovery Amount (Rs.)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white outline-none focus:border-rose-500"
                  required
                />
              </div>

              {editingEntry.entry_type === 'RECOVERY' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditPaymentMethod('CASH');
                        setEditBankName('');
                      }}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all ${
                        editPaymentMethod === 'CASH'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPaymentMethod('ONLINE')}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all ${
                        editPaymentMethod === 'ONLINE'
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      Online / Bank
                    </button>
                  </div>

                  {editPaymentMethod === 'ONLINE' && (
                    <div className="pt-1">
                      <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block mb-1">
                        Bank Name / Account Details
                      </label>
                      <input
                        type="text"
                        value={editBankName}
                        onChange={(e) => setEditBankName(e.target.value)}
                        placeholder="e.g. Meezan Bank, HBL, Allied..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        required={editPaymentMethod === 'ONLINE'}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Remarks
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSubmittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Entry Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Khata Entry"
        message="Are you sure you want to delete this ledger entry? If this was a credit sale, the deducted inventory stock will be restored automatically."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteEntry}
        onCancel={() => setDeleteDialog({ isOpen: false, entryId: undefined })}
        isDangerous={true}
      />
    </div>
  );
};

export default KhataDetail;
