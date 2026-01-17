
import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import StatCard from '../components/StatCard';
import { Building2, Package, TrendingUp, DollarSign, Banknote, CreditCard, Wallet, Loader2, ShoppingCart, TrendingDown } from 'lucide-react';
import api from '../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const { products, sales, loading: dataLoading } = useData();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await api.get('/reports/');
        setReport(response.data);
      } catch (error) {
        console.error('Failed to fetch report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  // Reload report every 5 seconds to get latest expense data
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await api.get('/reports/');
        setReport(response.data);
      } catch (error) {
        console.error('Failed to refresh report:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading || dataLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-emerald-500" />
        <p className="font-bold animate-pulse">Synchronizing Business Intel...</p>
      </div>
    );
  }

  // Get today's date in Pakistan timezone (Asia/Karachi - PKT/UTC+5)
  const getPakistanDate = () => {
    const now = new Date();
    const pakistanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    const year = pakistanTime.getFullYear();
    const month = String(pakistanTime.getMonth() + 1).padStart(2, '0');
    const day = String(pakistanTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getPakistanDate();
  const todaySales = sales.filter(s => s.date.startsWith(today));

  // Calculate today's credit and debit only (Pakistan time)
  const totalCredit = todaySales.filter(s => s.paymentType === 'Credit').reduce((acc, s) => acc + s.totalAmount, 0);
  const totalDebit = todaySales.filter(s => s.paymentType === 'Debit').reduce((acc, s) => acc + s.totalAmount, 0);

  const stats = report?.stats || {
    today_sales_revenue: 0,
    today_sales_profit: 0,
    total_expense: 0,
    net_profit: 0,
    total_inventory_value: 0,
    total_products: 0,
    low_stock_count: 0
  };

  const weeklyData = report?.weekly_sales || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Business Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time summary of your financial position</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Live Updates
        </div>
      </div>

      {/* Top Row: Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Sales Today"
          value={`Rs. ${Number(stats.today_sales_revenue || 0).toLocaleString()}`}
          icon={ShoppingCart}
          color="blue"
          trend="Today's revenue"
        />
        <StatCard
          label="Sales Profit"
          value={`Rs. ${Number(stats.today_sales_profit || 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
          trend="From sales"
        />
        <StatCard
          label="Total Expense"
          value={`Rs. ${Number(stats.total_expense || 0).toLocaleString()}`}
          icon={TrendingDown}
          color={Number(stats.total_expense || 0) >= 0 ? "green" : "red"}
          trend={Number(stats.total_expense || 0) >= 0 ? "Net income" : "Net expense"}
        />
        <StatCard
          label="Net Profit"
          value={`Rs. ${Number(stats.net_profit || 0).toLocaleString()}`}
          icon={TrendingUp}
          color={Number(stats.net_profit || 0) >= 0 ? "green" : "red"}
          trend="After expenses"
        />
      </div>

      {/* Second Row: Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Credit (Pending)"
          value={`Rs. ${totalCredit.toLocaleString()}`}
          icon={CreditCard}
          color="red"
          trend="To be received"
        />
        <StatCard
          label="Debit (Cash)"
          value={`Rs. ${totalDebit.toLocaleString()}`}
          icon={Wallet}
          color="blue"
          trend="Received"
        />
        <StatCard
          label="Active SKU"
          value={stats.total_products}
          icon={Package}
          color="yellow"
          trend="Products"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <Banknote className="text-emerald-600" />
            Weekly Sales Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px', fontWeight: 600 }}
                tickFormatter={(value) => `Rs. ${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white'
                }}
                formatter={(value: any) => [`Rs. ${value.toLocaleString()}`, 'Sales']}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Supply Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
            <Building2 className="text-indigo-500" />
            Supply Summary
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Low Stock Alerts</p>
              <p className="text-2xl font-black text-rose-500">{stats.low_stock_count || 0}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Inventory Valuation</p>
              <p className="text-2xl font-black text-blue-600">
                Rs. {Number(stats.total_inventory_value).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
          <Banknote className="text-emerald-600" />
          Today's Recent Transactions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest">
              <tr>
                <th className="pb-4 pr-4">Item Name</th>
                <th className="pb-4 pr-4">Customer</th>
                <th className="pb-4 pr-4">Amount</th>
                <th className="pb-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {todaySales.slice(0, 5).map(sale => {
                const product = products.find(p => p.id === sale.productId);
                return (
                  <tr key={sale.id} className="text-sm group transition-colors">
                    <td className="py-5 font-bold text-slate-900 dark:text-slate-100">{product?.name || 'Item'}</td>
                    <td className="py-5 text-slate-500">{sale.customerName}</td>
                    <td className="py-5 font-black text-slate-900 dark:text-white">Rs. {sale.totalAmount.toLocaleString()}</td>
                    <td className="py-5 text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${sale.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {sale.paymentType}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {todaySales.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 italic font-medium">No sales logged today.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
