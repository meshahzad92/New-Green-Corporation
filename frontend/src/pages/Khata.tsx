import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Plus, 
  User, 
  Phone, 
  CreditCard, 
  Wallet, 
  ArrowRight, 
  Pencil, 
  Trash2, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Users,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import { khataService, KhataAccount } from '../utils/khataApi';
import ConfirmDialog from '../components/ConfirmDialog';
import CreditSaleModal from '../components/CreditSaleModal';
import { formatAmount } from '../utils/formatters';

const Khata: React.FC = () => {
  const navigate = useNavigate();

  const [dealers, setDealers] = useState<KhataAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'settled'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modal states
  const [isAddDealerModalOpen, setIsAddDealerModalOpen] = useState(false);
  const [editDealer, setEditDealer] = useState<KhataAccount | null>(null);
  const [dealerName, setDealerName] = useState('');
  const [dealerPhone, setDealerPhone] = useState('');
  const [dealerAddress, setDealerAddress] = useState('');
  const [dealerRole, setDealerRole] = useState('Dealer');
  const [isSubmittingDealer, setIsSubmittingDealer] = useState(false);
  const [dealerModalError, setDealerModalError] = useState('');

  // Credit / Recovery modal
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditModalMode, setCreditModalMode] = useState<'credit' | 'recovery'>('credit');
  const [targetDealerId, setTargetDealerId] = useState<string | undefined>(undefined);

  // Confirm delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    dealerId?: string;
    dealerName?: string;
  }>({
    isOpen: false,
    dealerId: undefined,
    dealerName: undefined
  });

  // Blocked action popup (cannot delete if transactions exist)
  const [blockedDialog, setBlockedDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  useEffect(() => {
    loadDealers();
  }, []);

  const loadDealers = async () => {
    setLoading(true);
    try {
      const data = await khataService.getDealers();
      // Normalize Decimal strings → numbers (Pydantic serializes Decimal as string)
      const normalized = data.map(d => ({
        ...d,
        total_credit: parseFloat(String(d.total_credit)) || 0,
        total_recovery: parseFloat(String(d.total_recovery)) || 0,
        total_left: parseFloat(String(d.total_left)) || 0,
      }));
      setDealers(normalized);
    } catch (err) {
      console.error('Failed to load Khata dealers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDealer = () => {
    setEditDealer(null);
    setDealerName('');
    setDealerPhone('');
    setDealerAddress('');
    setDealerRole('Dealer');
    setDealerModalError('');
    setIsAddDealerModalOpen(true);
  };

  const handleOpenEditDealer = (dealer: KhataAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDealer(dealer);
    setDealerName(dealer.name);
    setDealerPhone(dealer.phone || '');
    setDealerAddress(dealer.address || '');
    setDealerRole(dealer.role || 'Dealer');
    setDealerModalError('');
    setIsAddDealerModalOpen(true);
  };

  const handleSaveDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDealer) return;
    if (!dealerName.trim()) {
      setDealerModalError('Please enter a person / dealer name.');
      return;
    }

    setIsSubmittingDealer(true);
    setDealerModalError('');
    try {
      if (editDealer) {
        await khataService.updateDealer(editDealer.id, {
          name: dealerName.trim(),
          phone: dealerPhone.trim() || undefined,
          address: dealerAddress.trim() || undefined,
          role: dealerRole.trim()
        });
      } else {
        await khataService.createDealer({
          name: dealerName.trim(),
          phone: dealerPhone.trim() || undefined,
          address: dealerAddress.trim() || undefined,
          role: dealerRole.trim()
        });
      }
      setIsAddDealerModalOpen(false);
      loadDealers();
    } catch (err: any) {
      console.error('Failed to save dealer:', err);
      const msg = err.response?.data?.detail || 'Could not save dealer. Please try again.';
      setDealerModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingDealer(false);
    }
  };

  const handleDeleteClick = (dealer: KhataAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dealer.entry_count > 0) {
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Dealer',
        message: `"${dealer.name}" has ${dealer.entry_count} transaction ${dealer.entry_count === 1 ? 'log' : 'logs'} recorded in their Khata (Total Credit: Rs. ${formatAmount(dealer.total_credit)}, Total Recovery: Rs. ${formatAmount(dealer.total_recovery)}). You cannot delete a dealer while active transactions exist. Please clear or delete all Khata entries first.`
      });
      return;
    }
    setDeleteDialog({
      isOpen: true,
      dealerId: dealer.id,
      dealerName: dealer.name
    });
  };

  const handleDeleteDealer = async () => {
    if (!deleteDialog.dealerId) return;
    try {
      await khataService.deleteDealer(deleteDialog.dealerId);
      setDeleteDialog({ isOpen: false, dealerId: undefined, dealerName: undefined });
      loadDealers();
    } catch (err: any) {
      console.error('Failed to delete dealer:', err);
      const errorMsg = err?.response?.data?.detail || 'Cannot delete dealer because there are active logs in their Khata.';
      setDeleteDialog({ isOpen: false, dealerId: undefined, dealerName: undefined });
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Dealer',
        message: errorMsg
      });
    }
  };

  // Aggregated Metrics
  const metrics = useMemo(() => {
    const totalAccounts = dealers.length;
    const totalCredit = dealers.reduce((sum, d) => sum + (parseFloat(String(d.total_credit)) || 0), 0);
    const totalRecovery = dealers.reduce((sum, d) => sum + (parseFloat(String(d.total_recovery)) || 0), 0);
    const totalPending = totalCredit - totalRecovery;
    return { totalAccounts, totalCredit, totalRecovery, totalPending };
  }, [dealers]);

  // Filtered Dealers
  const filteredDealers = useMemo(() => {
    return dealers.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.phone && d.phone.includes(searchTerm)) ||
        (d.address && d.address.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchSearch) return false;

      if (filterType === 'pending') {
        return parseFloat(String(d.total_left)) > 0;
      }
      if (filterType === 'settled') {
        return parseFloat(String(d.total_left)) <= 0;
      }
      return true;
    });
  }, [dealers, searchTerm, filterType]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-rose-600" />
            Khata System
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Maintain dealer credits, sprays distributed to farmers, and cash recoveries
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setTargetDealerId(undefined);
              setCreditModalMode('credit');
              setCreditModalOpen(true);
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-rose-600/20 active:scale-95 transition-all text-sm"
          >
            <CreditCard className="w-4 h-4 stroke-[2.5px]" />
            CREDIT SALE
          </button>
          <button
            onClick={() => {
              setTargetDealerId(undefined);
              setCreditModalMode('recovery');
              setCreditModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all text-sm"
          >
            <Wallet className="w-4 h-4 stroke-[2.5px]" />
            RECOVERY
          </button>
          <button
            onClick={handleOpenAddDealer}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl flex items-center gap-2 font-bold shadow-xl active:scale-95 transition-all text-sm"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            ADD DEALER
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Accounts */}
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Khata Accounts
            </p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalAccounts}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">Field Officers & Dealers</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Credit */}
        <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-3xl border border-rose-100 dark:border-rose-800/30 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">
              Total Credit Dispatched
            </p>
            <h3 className="text-3xl font-black text-rose-700 dark:text-rose-300">
              Rs. {formatAmount(metrics.totalCredit)}
            </h3>
            <p className="text-xs text-rose-600/70 dark:text-rose-400/70 font-bold mt-1">Total spray value given</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Total Recovery */}
        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
              Total Recovery Received
            </p>
            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
              Rs. {formatAmount(metrics.totalRecovery)}
            </h3>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-bold mt-1">Cash collected back</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Net Market Dues (Left) */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-6 rounded-3xl shadow-xl shadow-rose-600/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-1">
              Net Amount Left
            </p>
            <h3 className="text-3xl font-black">
              Rs. {formatAmount(metrics.totalPending)}
            </h3>
            <p className="text-xs text-rose-100 font-bold mt-1">Pending market credit</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealer, phone or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl flex-1 sm:flex-none">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({dealers.length})
            </button>
            <button
              onClick={() => setFilterType('pending')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'pending'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Pending Dues ({dealers.filter(d => d.total_left > 0).length})
            </button>
            <button
              onClick={() => setFilterType('settled')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'settled'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              Settled ({dealers.filter(d => d.total_left <= 0).length})
            </button>
          </div>

          {/* List vs Grid View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="List View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dealers Display: List View or Grid View */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-rose-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">Loading Khata Accounts...</p>
        </div>
      ) : filteredDealers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-700">
          <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {dealers.length === 0 ? 'No Khata Accounts Yet' : 'No matching dealers found'}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto mb-6">
            {dealers.length === 0
              ? 'Add your first field officer, dealer, or customer to start maintaining their credit and spray records.'
              : 'Try adjusting your search or filter options.'}
          </p>
          {dealers.length === 0 && (
            <button
              onClick={handleOpenAddDealer}
              className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-rose-600/20 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Dealer
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* List / Table View (Compact & Scannable for Many Dealers) */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Dealer / Account</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-right text-rose-500">Total Credit</th>
                  <th className="px-6 py-4 text-right text-emerald-500">Total Recovery</th>
                  <th className="px-6 py-4 text-right">Net Amount Left</th>
                  <th className="px-6 py-4 text-center">Entries</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredDealers.map(dealer => {
                  const hasPending = dealer.total_left > 0;
                  const initials = dealer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <tr
                      key={dealer.id}
                      onClick={() => navigate(`/khata/${dealer.id}`)}
                      className="hover:bg-rose-50/30 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                    >
                      {/* Name + Avatar + Role */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-black text-xs flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                            {initials || 'KH'}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm group-hover:text-rose-600 transition-colors">
                              {dealer.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-bold">
                              {dealer.role || 'Field Officer'}
                            </div>
                            {dealer.address && (
                              <div className="text-[11px] text-slate-400 font-semibold max-w-xs truncate" title={dealer.address}>
                                {dealer.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                        {dealer.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{dealer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                        )}
                      </td>

                      {/* Total Credit */}
                      <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {hasPending ? `Rs. ${formatAmount(dealer.total_credit)}` : <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>}
                      </td>

                      {/* Total Recovery */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                      </td>

                      {/* Net Amount Left */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {hasPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                            Rs. {formatAmount(dealer.total_left)} Left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Settled
                          </span>
                        )}
                      </td>

                      {/* Entries Count */}
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                          {dealer.entry_count}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/khata/${dealer.id}`)}
                            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                            title="Open Ledger"
                          >
                            <span>Ledger</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEditDealer(dealer, e)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60"
                            title="Edit Dealer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(dealer, e)}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60"
                            title="Delete Dealer"
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
        </div>
      ) : (
        /* Grid View Alternative */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDealers.map(dealer => {
            const hasPending = dealer.total_left > 0;
            const initials = dealer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <div
                key={dealer.id}
                onClick={() => navigate(`/khata/${dealer.id}`)}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl hover:border-rose-200 dark:hover:border-rose-900/40 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Avatar, Name, Actions */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white font-black text-sm flex items-center justify-center shadow-md shadow-rose-500/20">
                        {initials || 'KH'}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-white text-base group-hover:text-rose-600 transition-colors">
                          {dealer.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                          {dealer.phone ? (
                            <>
                              <Phone className="w-3 h-3 text-blue-500" />
                              {dealer.phone}
                            </>
                          ) : (
                            <span>{dealer.role || 'Field Officer'}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleOpenEditDealer(dealer, e)}
                        className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60"
                        title="Edit Dealer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(dealer, e)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60"
                        title="Delete Dealer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className={`p-4 rounded-2xl mb-4 border ${
                    hasPending
                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30'
                  }`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest block mb-0.5 ${
                      hasPending ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {hasPending ? 'Pending Amount Left' : 'Status'}
                    </span>
                    <div className="flex justify-between items-baseline">
                      <span className={`text-2xl font-black ${
                        hasPending ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {hasPending ? `Rs. ${formatAmount(dealer.total_left)}` : '✓ Fully Settled'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {dealer.entry_count} {dealer.entry_count === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  </div>

                  {/* Credit vs Recovery Breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Credit</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {hasPending ? `Rs. ${formatAmount(dealer.total_credit)}` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Recovery</span>
                      <span className="font-bold text-slate-400 font-medium">
                        —
                      </span>
                    </div>
                  </div>
                </div>

                {/* View Ledger Footer Link */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Khata Ledger</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dealer Modal */}
      {isAddDealerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {editDealer ? 'Edit Dealer Details' : 'Add New Dealer / Officer'}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Field officers, distributors, or persons taking credit
              </p>
            </div>

            {dealerModalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold">
                {dealerModalError}
              </div>
            )}

            <form onSubmit={handleSaveDealer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Dealer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahad, Salman, New Green Corp"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="03001234567"
                  value={dealerPhone}
                  onChange={(e) => setDealerPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Address (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Village, city, market, or shop address"
                  value={dealerAddress}
                  onChange={(e) => setDealerAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Role / Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Field Officer, Dealer, Customer"
                  value={dealerRole}
                  onChange={(e) => setDealerRole(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDealerModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDealer}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingDealer ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editDealer ? 'Update Dealer' : 'Add Dealer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Sale & Recovery Modal */}
      <CreditSaleModal
        isOpen={creditModalOpen}
        onClose={() => {
          setCreditModalOpen(false);
          loadDealers();
        }}
        initialDealerId={targetDealerId}
        defaultMode={creditModalMode}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Remove Dealer Khata"
        message={`Are you sure you want to remove "${deleteDialog.dealerName}" from the Khata system? Historical logs will be preserved in database audits.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={handleDeleteDealer}
        onCancel={() => setDeleteDialog({ isOpen: false, dealerId: undefined, dealerName: undefined })}
        isDangerous={true}
      />

      {/* Blocked Action Dialog (When Logs Exist) */}
      <ConfirmDialog
        isOpen={blockedDialog.isOpen}
        title={blockedDialog.title}
        message={blockedDialog.message}
        confirmText="Understood"
        onCancel={() => setBlockedDialog({ isOpen: false, title: '', message: '' })}
        alertOnly={true}
        isDangerous={true}
      />
    </div>
  );
};

export default Khata;
