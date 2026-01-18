
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Layers, Plus, Search, AlertCircle, ArrowUpRight, X, History, ClipboardList, Building2, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';

const StockPage: React.FC = () => {
  const { products, stocks, stockTransactions, companies, addStock, deleteStockTransaction } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'balance' | 'logs'>('balance');
  const [specificDate, setSpecificDate] = useState<Date | null>(null); // Use Date object

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    transactionId: '',
    productName: '',
    partyName: ''
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompany === 'all' || p.companyId === selectedCompany;
    return matchesSearch && matchesCompany;
  });

  const filteredLogs = stockTransactions.filter(t => {
    if (t.type !== 'IN') return false; // Show only added logs

    const product = products.find(prod => prod.id === t.productId);
    const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.partyName.toLowerCase().includes(searchTerm.toLowerCase());

    const logDate = new Date(t.date);

    if (specificDate) {
      return logDate.toDateString() === specificDate.toDateString();
    }

    return matchesSearch;
  });

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    const cost = parseFloat(purchasePrice);
    if (!selectedProductId || !qty || qty <= 0) return;
    addStock(selectedProductId, qty, partyName || 'Direct Supply', cost);
    setIsModalOpen(false);
    setSelectedProductId('');
    setQuantity('');
    setPartyName('');
    setPurchasePrice('0');
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0')) setter(val.slice(1));
    else setter(val);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Inventory Ledger</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Track supplier arrivals and current balances</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          STOCK INWARD
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-fit">
          <button
            onClick={() => setActiveTab('balance')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'balance' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ClipboardList className="w-4 h-4" />
            Balance
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History className="w-4 h-4" />
            Stock In Logs
          </button>
        </div>

        {activeTab === 'balance' ? (
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 px-1 items-center no-scrollbar w-full md:flex-1">
            <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Companies:</span>
            <button onClick={() => setSelectedCompany('all')} className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap ${selectedCompany === 'all' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>All</button>
            {companies.map(company => (
              <button key={company.id} onClick={() => setSelectedCompany(company.id)} className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap ${selectedCompany === company.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
                {company.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Day Buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => setSpecificDate(new Date())}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date().toDateString()
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-emerald-600'
                  }`}
              >
                📅 Today
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSpecificDate(yesterday);
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date(new Date().setDate(new Date().getDate() - 1)).toDateString()
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-blue-600'
                  }`}
              >
                ⏮️ Yesterday
              </button>
              <button
                onClick={() => setSpecificDate(null)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${!specificDate ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'
                  }`}
              >
                All Logs
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="w-48">
              <CustomDatePicker
                selected={specificDate}
                onChange={(date) => setSpecificDate(date)}
                placeholderText="Pick a date..."
                maxDate={new Date()}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-700">
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'balance' ? 'products' : 'suppliers'}...`}
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-bold text-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'balance' ? (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-8 py-6">Product Details</th>
                  <th className="px-8 py-6">In Stock</th>
                  <th className="px-8 py-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredProducts.map((product) => {
                  const stock = stocks.find(s => s.productId === product.id);
                  const remaining = stock?.remaining || 0;
                  const isCritical = remaining < 20;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-8 py-6">
                        <p className="font-bold text-slate-900 dark:text-white text-base">{product.name}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight mt-0.5">{product.unit}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`font-black text-xl ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        {isCritical ? (
                          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-4 py-1.5 rounded-full text-[10px] font-black w-fit border border-rose-100 dark:border-rose-800/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            CRITICAL
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-1.5 rounded-full text-[10px] font-black w-fit border border-emerald-100 dark:border-emerald-800/20">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            NORMAL
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-8 py-6">Date</th>
                  <th className="px-8 py-6">Source (Party)</th>
                  <th className="px-8 py-6">Item Name</th>
                  <th className="px-8 py-6">Qty Added</th>
                  <th className="px-8 py-6">Inward Cost</th>
                  <th className="px-8 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredLogs.map((transaction) => {
                  const product = products.find(p => p.id === transaction.productId);
                  return (
                    <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-8 py-6 text-slate-500 dark:text-slate-400 font-bold text-sm">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                          {transaction.partyName}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-600 dark:text-slate-300">
                        {product?.name || 'Unknown'}
                      </td>
                      <td className="px-8 py-6">
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg font-black text-sm">
                          + {transaction.quantity}
                        </span>
                      </td>
                      <td className="px-8 py-6 italic font-black text-slate-900 dark:text-white">
                        Rs. {transaction.purchasePrice.toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => {
                            const product = products.find(p => p.id === transaction.productId);
                            setConfirmDialog({
                              isOpen: true,
                              transactionId: transaction.id,
                              productName: product?.name || 'Unknown',
                              partyName: transaction.partyName
                            });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filteredProducts.length === 0 && (
            <div className="py-24 text-center text-slate-400">
              <Layers className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold">No results found.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <Layers className="w-6 h-6" /> Stock Inward
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStock} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Party Name (Source)</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="Supplier/Party name..."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Select Item</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedProductId(id);
                    const prod = products.find(p => p.id === id);
                    if (prod) setPurchasePrice(prod.purchasePrice.toString());
                  }}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white appearance-none"
                  required
                >
                  <option value="">Choose item...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleNumChange(setQuantity, e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Cost Price</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => handleNumChange(setPurchasePrice, e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 uppercase tracking-widest"
              >
                Save Log
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Remove Stock Entry"
        message={`Are you sure you want to remove this stock entry for "${confirmDialog.productName}" from "${confirmDialog.partyName}"? This will adjust the inventory accordingly.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={() => deleteStockTransaction(confirmDialog.transactionId)}
        onCancel={() => setConfirmDialog({ isOpen: false, transactionId: '', productName: '', partyName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default StockPage;
