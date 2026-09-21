import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import api from '../utils/api';
import { 
  Database, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  RefreshCw, 
  Building2, 
  Package, 
  ShoppingCart, 
  Layers, 
  Receipt,
  X
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

interface BackupStats {
  companies: number;
  products: number;
  sales: number;
  stock_transactions: number;
  expenses: number;
  notes?: number;
  khata_accounts?: number;
  khata_entries?: number;
  company_khata_accounts?: number;
  company_khata_entries?: number;
  money_accounts?: number;
  money_transactions?: number;
}

const Backup: React.FC = () => {
  const { companies, products, sales, stockTransactions, refreshData } = useData();

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  // Import states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [fileStats, setFileStats] = useState<BackupStats | null>(null);
  const [fileError, setFileError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{ message: string; counts?: BackupStats } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Handle Export
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess('');
    try {
      const response = await api.get('/backup/export');
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const filename = `agrimanage_backup_${dateStr}_${timeStr}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(`Backup downloaded successfully as "${filename}"!`);
      setTimeout(() => setExportSuccess(''), 6000);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Failed to export backup: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setFileError('Please select a valid .json file.');
      setSelectedFile(null);
      setParsedData(null);
      setFileStats(null);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const db = parsed.database || parsed;

        const stats: BackupStats = {
          companies: Array.isArray(db.companies) ? db.companies.length : 0,
          products: Array.isArray(db.products) ? db.products.length : 0,
          sales: Array.isArray(db.sales) ? db.sales.length : 0,
          stock_transactions: Array.isArray(db.stock_transactions) ? db.stock_transactions.length : 0,
          expenses: Array.isArray(db.expenses) ? db.expenses.length : 0,
          notes: Array.isArray(db.notes) ? db.notes.length : 0,
          khata_accounts: Array.isArray(db.khata_accounts) ? db.khata_accounts.length : 0,
          company_khata_accounts: Array.isArray(db.company_khata_accounts) ? db.company_khata_accounts.length : 0,
          money_accounts: Array.isArray(db.money_accounts) ? db.money_accounts.length : 0,
        };

        const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
        if (totalRecords === 0) {
          setFileError('The selected JSON file does not contain recognisable AgriManage database tables.');
          setParsedData(null);
          setFileStats(null);
          return;
        }

        setParsedData(parsed);
        setFileStats(stats);
      } catch (err) {
        setFileError('Invalid JSON format: Could not parse this file.');
        setParsedData(null);
        setFileStats(null);
      }
    };
    reader.readAsText(file);
  };

  // Handle Import Submit
  const handleImportConfirm = async () => {
    if (!parsedData) return;
    setConfirmOpen(false);
    setIsImporting(true);
    setFileError('');
    setImportSuccess(null);

    try {
      const response = await api.post('/backup/import', parsedData);
      setImportSuccess({
        message: response.data.message || 'Data restored successfully!',
        counts: response.data.imported_counts
      });
      setSelectedFile(null);
      setParsedData(null);
      setFileStats(null);
      await refreshData();
    } catch (err: any) {
      console.error('Import failed:', err);
      setFileError('Import failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            Database Backup & Restore
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Export full system data in PostgreSQL-compatible JSON format, or restore from previous backups.
          </p>
        </div>
      </div>

      {/* Live Database Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Building2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider">Companies</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{companies.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black uppercase tracking-wider">Products</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{products.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <ShoppingCart className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-black uppercase tracking-wider">Sales</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{sales.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-wider">Stock Logs</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stockTransactions.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* EXPORT CARD */}
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-200/60 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center shadow-inner">
              <Download className="w-7 h-7 stroke-[2.5px]" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Export Database (JSON)
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">
                Download a complete, structured snapshot of your entire database. The exported JSON strictly matches database tables and columns, making it safe for re-importing anytime.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Companies, Products, MRP & Discounts</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Sales Ledger, Invoices & Payment Status</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Stock Arrivals, Party Names & History</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Expenses, Quantities & Details</span>
              </div>
            </div>

            {exportSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {exportSuccess}
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating Backup...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 stroke-[2.5px]" />
                Download JSON Backup
              </>
            )}
          </button>
        </div>

        {/* IMPORT CARD */}
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-200/60 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center shadow-inner">
              <Upload className="w-7 h-7 stroke-[2.5px]" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Import & Restore (JSON)
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">
                Restore or synchronize data from an existing JSON backup file. All IDs, timestamps, and relations will be preserved.
              </p>
            </div>

            {/* File Upload Box */}
            <div className="relative">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                className={`cursor-pointer w-full p-6 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
                  selectedFile 
                    ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-900/40'
                }`}
              >
                <FileJson className={`w-10 h-10 mb-2 ${selectedFile ? 'text-blue-600' : 'text-slate-400'}`} />
                {selectedFile ? (
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                      Click to choose a JSON backup file
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Must be a valid AgriManage JSON export file
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Preview of file contents if parsed */}
            {fileStats && (
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Detected in Backup:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Companies</span>
                    <span className="font-black text-slate-800 dark:text-white">{fileStats.companies}</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Products</span>
                    <span className="font-black text-slate-800 dark:text-white">{fileStats.products}</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sales</span>
                    <span className="font-black text-slate-800 dark:text-white">{fileStats.sales}</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Stock Logs</span>
                    <span className="font-black text-slate-800 dark:text-white">{fileStats.stock_transactions}</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Expenses</span>
                    <span className="font-black text-slate-800 dark:text-white">{fileStats.expenses}</span>
                  </div>
                  {fileStats.khata_accounts !== undefined && fileStats.khata_accounts > 0 && (
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Dealers</span>
                      <span className="font-black text-slate-800 dark:text-white">{fileStats.khata_accounts}</span>
                    </div>
                  )}
                  {fileStats.company_khata_accounts !== undefined && fileStats.company_khata_accounts > 0 && (
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Co. Khata</span>
                      <span className="font-black text-slate-800 dark:text-white">{fileStats.company_khata_accounts}</span>
                    </div>
                  )}
                  {fileStats.money_accounts !== undefined && fileStats.money_accounts > 0 && (
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Money Accs</span>
                      <span className="font-black text-slate-800 dark:text-white">{fileStats.money_accounts}</span>
                    </div>
                  )}
                  {fileStats.notes !== undefined && fileStats.notes > 0 && (
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Notes</span>
                      <span className="font-black text-slate-800 dark:text-white">{fileStats.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {fileError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-900/30 animate-in fade-in flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {fileError}
              </div>
            )}

            {importSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-in fade-in space-y-1">
                <div className="flex items-center gap-2 font-black">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {importSuccess.message}
                </div>
                {importSuccess.counts && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pl-6">
                    Processed: {importSuccess.counts.companies} companies, {importSuccess.counts.products} products, {importSuccess.counts.sales} sales, {importSuccess.counts.stock_transactions} stock logs, {importSuccess.counts.expenses} expenses.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!parsedData || isImporting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Importing & Synchronizing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 stroke-[2.5px]" />
                Restore / Import Backup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm Database Import"
        message="Are you sure you want to import this JSON backup? Existing records matching IDs will be updated and missing records will be inserted safely."
        confirmText="Yes, Proceed with Import"
        cancelText="Cancel"
        onConfirm={handleImportConfirm}
        onCancel={() => setConfirmOpen(false)}
        isDangerous={false}
      />
    </div>
  );
};

export default Backup;
