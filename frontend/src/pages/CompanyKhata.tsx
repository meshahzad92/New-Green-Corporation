import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Banknote,
  Package,
  CreditCard,
  Wallet,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutList,
  LayoutGrid,
  Pencil,
  Trash2,
  Phone
} from 'lucide-react';
import { companyKhataService, CompanyKhataOverview, CompanyAccount } from '../utils/companyKhataApi';
import CompanyPaymentModal from '../components/CompanyPaymentModal';
import CompanyPurchaseModal from '../components/CompanyPurchaseModal';
import AddCompanyAccountModal from '../components/AddCompanyAccountModal';
import ConfirmDialog from '../components/ConfirmDialog';

const CompanyKhata: React.FC = () => {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<CompanyKhataOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'advance' | 'payable' | 'settled'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modal states
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CompanyAccount | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | undefined>(undefined);

  // Delete dialog & blocked dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    company?: CompanyKhataOverview;
  }>({
    isOpen: false,
    company: undefined
  });

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
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await companyKhataService.getOverview();
      setCompanies(data);
    } catch (err) {
      console.error('Failed to load Company Khata overview:', err);
    } finally {
      setLoading(false);
    }
  };

  // Metrics computation with defensive number parsing (prevents NaN / string concatenation)
  const metrics = useMemo(() => {
    const totalCompanies = companies.length;
    const totalPaid = companies.reduce((acc, c) => acc + (Number(c.total_paid) || 0), 0);
    const totalPurchased = companies.reduce((acc, c) => acc + (Number(c.total_purchased) || 0), 0);
    const netOverall = totalPaid - totalPurchased;
    const totalAdvance = companies
      .filter(c => (Number(c.net_balance) || 0) > 0)
      .reduce((acc, c) => acc + (Number(c.net_balance) || 0), 0);
    const totalPayable = companies
      .filter(c => (Number(c.net_balance) || 0) < 0)
      .reduce((acc, c) => acc + Math.abs(Number(c.net_balance) || 0), 0);

    return {
      totalCompanies,
      totalPaid,
      totalPurchased,
      netOverall,
      totalAdvance,
      totalPayable
    };
  }, [companies]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const cName = (c.name || c.company_name || '').toLowerCase();
      const cPhone = (c.phone || '').toLowerCase();
      const s = searchTerm.toLowerCase();
      const matchesSearch = cName.includes(s) || cPhone.includes(s);
      if (!matchesSearch) return false;

      const net = Number(c.net_balance) || 0;
      if (filterType === 'advance') return net > 0;
      if (filterType === 'payable') return net < 0;
      if (filterType === 'settled') return net === 0;
      return true;
    });
  }, [companies, searchTerm, filterType]);

  const handleOpenPayment = (companyId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveCompanyId(companyId);
    setIsPaymentModalOpen(true);
  };

  const handleOpenPurchase = (companyId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveCompanyId(companyId);
    setIsPurchaseModalOpen(true);
  };

  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setIsAddAccountModalOpen(true);
  };

  const handleOpenEditAccount = (c: CompanyKhataOverview, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount({
      id: c.account_id || c.company_id,
      name: c.name || c.company_name,
      phone: c.phone || '',
      catalog_company_id: c.catalog_company_id || '',
      created_at: '',
      is_deleted: false
    });
    setIsAddAccountModalOpen(true);
  };

  const handleDeleteClick = (c: CompanyKhataOverview, e: React.MouseEvent) => {
    e.stopPropagation();
    if (c.entry_count > 0) {
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Company',
        message: `Company "${c.name || c.company_name}" cannot be deleted because it has ${c.entry_count} transaction log(s) in its Khata. Please remove all payments and inward stock entries before deleting this company.`
      });
      return;
    }
    setDeleteDialog({
      isOpen: true,
      company: c
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.company) return;
    try {
      const id = deleteDialog.company.account_id || deleteDialog.company.company_id;
      await companyKhataService.deleteAccount(id);
      setDeleteDialog({ isOpen: false, company: undefined });
      loadOverview();
    } catch (err: any) {
      console.error('Failed to delete company account:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Company Khata
            </h1>
            <p className="text-xs font-bold text-slate-400">
              Supplier financial ledgers, advance payments & inward deliveries
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleOpenAddAccount}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl flex items-center gap-2 font-bold shadow-lg active:scale-95 transition-all text-xs"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            ADD COMPANY
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Companies */}
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Khata Companies
            </p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalCompanies}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">Tracked Suppliers</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Payments Made */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
              Total Amount Paid Out
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
              Rs. {metrics.totalPaid.toLocaleString()}
            </h3>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-bold mt-1">
              Advances & bank transfers
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
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
              Rs. {metrics.totalPurchased.toLocaleString()}
            </h3>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-bold mt-1">
              Inward shipment value
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Net Market Standing (Advance vs Payable) */}
        {metrics.netOverall >= 0 ? (
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-xl shadow-emerald-600/20 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-1">
                Net Advance with Companies
              </p>
              <h3 className="text-2xl sm:text-3xl font-black">
                Rs. {metrics.netOverall.toLocaleString()}
              </h3>
              <p className="text-xs text-emerald-100 font-bold mt-1">Our advance balance safe</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-6 rounded-3xl shadow-xl shadow-rose-600/20 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-1">
                Net Payable to Companies
              </p>
              <h3 className="text-2xl sm:text-3xl font-black">
                Rs. {Math.abs(metrics.netOverall).toLocaleString()}
              </h3>
              <p className="text-xs text-rose-100 font-bold mt-1">Dues pending for products</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search company or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl flex-1 sm:flex-none">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({companies.length})
            </button>
            <button
              onClick={() => setFilterType('advance')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'advance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Advance ({companies.filter(c => (Number(c.net_balance) || 0) > 0).length})
            </button>
            <button
              onClick={() => setFilterType('payable')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'payable'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Payable ({companies.filter(c => (Number(c.net_balance) || 0) < 0).length})
            </button>
            <button
              onClick={() => setFilterType('settled')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                filterType === 'settled'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Settled ({companies.filter(c => (Number(c.net_balance) || 0) === 0).length})
            </button>
          </div>

          {/* View Toggle (List vs Grid) */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('list')}
              title="Table / List View"
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Company Accounts...</p>
        </div>
      ) : companies.length === 0 ? (
        /* Empty State: No companies added yet */
        <div className="p-16 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No Companies in Khata Yet</h3>
          <p className="text-sm font-medium text-slate-400 max-w-md mx-auto mt-2 mb-6">
            Click "+ ADD COMPANY" to add a supplier or company ledger account to track payments and inward stock.
          </p>
          <button
            onClick={handleOpenAddAccount}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            ADD YOUR FIRST COMPANY
          </button>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-base font-black text-slate-900 dark:text-white">No Matching Companies</p>
          <p className="text-xs font-bold text-slate-400 mt-1">
            No results matching "{searchTerm}"
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* Table / List View */
        <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Company</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Paid (Out)</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Stock Received</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Net Balance</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Entries</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredCompanies.map((c) => {
                  const targetId = c.account_id || c.company_id;
                  const displayName = c.name || c.company_name;
                  const paidNum = Number(c.total_paid) || 0;
                  const purchNum = Number(c.total_purchased) || 0;
                  const netNum = Number(c.net_balance) || 0;
                  const isAdvance = netNum > 0;
                  const isPayable = netNum < 0;
                  const isSettled = netNum === 0;

                  return (
                    <tr
                      key={targetId}
                      onClick={() => navigate(`/company-khata/${targetId}`)}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-750/50 transition cursor-pointer"
                    >
                      {/* Company Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs shadow-sm flex-shrink-0">
                            {c.company_logo ? (
                              <img src={`/logos/${c.company_logo}`} alt={displayName} className="w-full h-full object-contain p-1 rounded-xl" />
                            ) : (
                              displayName.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                              {displayName}
                            </div>
                            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                              {c.phone && <span>{c.phone} •</span>}
                              <span>{c.products_count} catalog product{c.products_count !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Paid */}
                      <td className="py-4 px-6 text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                        Rs. {paidNum.toLocaleString()}
                      </td>

                      {/* Stock Received */}
                      <td className="py-4 px-6 text-right font-black text-sm text-blue-600 dark:text-blue-400">
                        Rs. {purchNum.toLocaleString()}
                      </td>

                      {/* Net Balance Badge */}
                      <td className="py-4 px-6 text-center">
                        {isAdvance && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            + Advance: Rs. {netNum.toLocaleString()}
                          </span>
                        )}
                        {isPayable && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            - Payable: Rs. {Math.abs(netNum).toLocaleString()}
                          </span>
                        )}
                        {isSettled && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Settled (Rs. 0)
                          </span>
                        )}
                      </td>

                      {/* Entries count */}
                      <td className="py-4 px-6 text-center">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          {c.entry_count} log{c.entry_count !== 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEditAccount(c, e)}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            title="Edit Account"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(c, e)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/company-khata/${targetId}`)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition ml-1"
                            title="Open Ledger"
                          >
                            Ledger <ArrowRight className="w-3.5 h-3.5" />
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
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((c) => {
            const targetId = c.account_id || c.company_id;
            const displayName = c.name || c.company_name;
            const paidNum = Number(c.total_paid) || 0;
            const purchNum = Number(c.total_purchased) || 0;
            const netNum = Number(c.net_balance) || 0;
            const isAdvance = netNum > 0;
            const isPayable = netNum < 0;

            return (
              <div
                key={targetId}
                onClick={() => navigate(`/company-khata/${targetId}`)}
                className="group bg-white dark:bg-slate-800/80 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-sm shadow-sm">
                        {c.company_logo ? (
                          <img src={`/logos/${c.company_logo}`} alt={displayName} className="w-full h-full object-contain p-1 rounded-2xl" />
                        ) : (
                          displayName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {displayName}
                        </h3>
                        <p className="text-xs font-bold text-slate-400">
                          {c.phone || `${c.products_count} catalog products`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-750 px-2 py-1 rounded-lg">
                      {c.entry_count} logs
                    </span>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paid Out</span>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Rs. {paidNum.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stock In</span>
                      <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                        Rs. {purchNum.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Net Balance Status */}
                  <div className="mb-4">
                    {isAdvance && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Advance Available:</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                          Rs. {netNum.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {isPayable && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/30 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Payable Dues:</span>
                        <span className="text-sm font-black text-rose-700 dark:text-rose-300">
                          Rs. {Math.abs(netNum).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {!isAdvance && !isPayable && (
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                        <span>Account Balance:</span>
                        <span>Settled (Rs. 0)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEditAccount(c, e)}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 transition"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(c, e)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => navigate(`/company-khata/${targetId}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    Ledger <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Company Account Modal */}
      <AddCompanyAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onSuccess={() => loadOverview()}
        editAccount={editingAccount}
      />

      {/* Payment & Purchase Modals */}
      <CompanyPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => loadOverview()}
        preselectedCompanyId={activeCompanyId}
        companiesList={companies}
      />

      <CompanyPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={() => loadOverview()}
        preselectedCompanyId={activeCompanyId}
        companiesList={companies}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Company Account?"
        message={`Are you sure you want to delete company "${deleteDialog.company?.name || deleteDialog.company?.company_name}" from Company Khata?`}
        confirmText="Yes, Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, company: undefined })}
      />

      {/* Blocked Deletion Popup */}
      <ConfirmDialog
        isOpen={blockedDialog.isOpen}
        title={blockedDialog.title}
        message={blockedDialog.message}
        confirmText="Understood"
        confirmVariant="primary"
        hideCancelButton={true}
        onConfirm={() => setBlockedDialog({ isOpen: false, title: '', message: '' })}
        onCancel={() => setBlockedDialog({ isOpen: false, title: '', message: '' })}
      />
    </div>
  );
};

export default CompanyKhata;
