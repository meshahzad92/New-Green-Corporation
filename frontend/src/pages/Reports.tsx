
import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
import { calculateProfit } from '../utils/calculations';
import { Calendar, TrendingUp, Award, DollarSign, CreditCard, Wallet, ShoppingCart, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import axios from 'axios';
import CustomDatePicker from '../components/CustomDatePicker';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

type PeriodType = '1month' | '3months' | '6months' | '1year' | 'custom';

interface PeriodSummary {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  sales_summary: {
    total_sales_count: number;
    total_quantity_sold: number;
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    profit_margin: number;
  };
  expense_summary: {
    total_expenses: number;
    total_income: number;
    net_expense: number;
    expense_count: number;
  };
  credit_debit: {
    total_credit: number;
    total_cash: number;
    credit_count: number;
    cash_count: number;
    credit_percentage: number;
  };
  overall: {
    net_profit: number;
    total_transactions: number;
  };
  daily_breakdown: Array<{
    date: string;
    revenue: number;
    profit: number;
    expenses: number;
  }>;
}

const Reports: React.FC = () => {
  const { sales, products, companies } = useData();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1month');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate date ranges based on selected period
  const getDateRange = () => {
    const today = new Date();
    let startDate = new Date();

    switch (selectedPeriod) {
      case '1month':
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(today.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: customStartDate.toISOString().split('T')[0],
            end: customEndDate.toISOString().split('T')[0]
          };
        }
        // Default to last month if custom dates not set
        startDate.setMonth(today.getMonth() - 1);
        break;
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };

  // Fetch period summary from backend
  const fetchPeriodSummary = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      const response = await axios.get(`${API_URL}/reports/period-summary`, {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end
        }
      });
      setPeriodSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch period summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when period changes
  useEffect(() => {
    fetchPeriodSummary();
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Aggregate daily sales for current view (local calculation for comparison)
  const dailyData = useMemo(() => {
    const map = new Map();
    sales.forEach(s => {
      const date = new Date(s.date).toLocaleDateString();
      const current = map.get(date) || { date, revenue: 0, profit: 0 };
      current.revenue += s.totalAmount;
      current.profit += calculateProfit(s);
      map.set(date, current);
    });
    return Array.from(map.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-15);
  }, [sales]);

  // Top products by sales
  const productPerformance = useMemo(() => {
    const map = new Map();
    sales.forEach(s => {
      const p = products.find(prod => prod.id === s.productId);
      const name = p?.name || 'Unknown';
      const current = map.get(name) || { name, sales: 0, profit: 0 };
      current.sales += s.quantity;
      current.profit += calculateProfit(s);
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [sales, products]);

  // Company distribution
  const companyPerformance = useMemo(() => {
    const map = new Map();
    sales.forEach(s => {
      const p = products.find(prod => prod.id === s.productId);
      const c = companies.find(comp => comp.id === p?.companyId);
      const name = c?.name || 'Other';
      const current = map.get(name) || { name, value: 0 };
      current.value += s.totalAmount;
      map.set(name, current);
    });
    return Array.from(map.values());
  }, [sales, products, companies]);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#6366F1', '#EC4899'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <p className="text-gray-500">Comprehensive financial insights for your business</p>
      </div>

      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-500" />
          <h2 className="text-lg font-bold">Select Report Period</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <button
            onClick={() => setSelectedPeriod('1month')}
            className={`px-4 py-3 rounded-xl font-semibold transition-all ${selectedPeriod === '1month'
              ? 'bg-blue-500 text-white shadow-lg scale-105'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            1 Month
          </button>
          <button
            onClick={() => setSelectedPeriod('3months')}
            className={`px-4 py-3 rounded-xl font-semibold transition-all ${selectedPeriod === '3months'
              ? 'bg-blue-500 text-white shadow-lg scale-105'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            3 Months
          </button>
          <button
            onClick={() => setSelectedPeriod('6months')}
            className={`px-4 py-3 rounded-xl font-semibold transition-all ${selectedPeriod === '6months'
              ? 'bg-blue-500 text-white shadow-lg scale-105'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            6 Months
          </button>
          <button
            onClick={() => setSelectedPeriod('1year')}
            className={`px-4 py-3 rounded-xl font-semibold transition-all ${selectedPeriod === '1year'
              ? 'bg-blue-500 text-white shadow-lg scale-105'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            1 Year
          </button>
          <button
            onClick={() => setSelectedPeriod('custom')}
            className={`px-4 py-3 rounded-xl font-semibold transition-all ${selectedPeriod === 'custom'
              ? 'bg-blue-500 text-white shadow-lg scale-105'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Range */}
        {selectedPeriod === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Start Date</label>
              <div style={{ backgroundColor: 'transparent' }}>
                <CustomDatePicker
                  selected={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  placeholderText="Select start date"
                  maxDate={customEndDate || new Date()}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">End Date</label>
              <div style={{ backgroundColor: 'transparent' }}>
                <CustomDatePicker
                  selected={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  placeholderText="Select end date"
                  minDate={customStartDate || undefined}
                  maxDate={new Date()}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-500">Loading financial data...</p>
        </div>
      ) : periodSummary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="text-sm font-semibold opacity-90">Total Revenue</h3>
              </div>
              <p className="text-3xl font-black">Rs. {periodSummary.sales_summary.total_revenue.toLocaleString()}</p>
              <p className="text-sm opacity-80 mt-2">{periodSummary.sales_summary.total_sales_count} sales</p>
            </div>

            {/* Gross Profit */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-3xl shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <h3 className="text-sm font-semibold opacity-90">Gross Profit</h3>
              </div>
              <p className="text-3xl font-black">Rs. {periodSummary.sales_summary.gross_profit.toLocaleString()}</p>
              <p className="text-sm opacity-80 mt-2">{periodSummary.sales_summary.profit_margin}% margin</p>
            </div>

            {/* Net Profit */}
            <div className={`bg-gradient-to-br ${periodSummary.overall.net_profit >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600'} text-white p-6 rounded-3xl shadow-lg`}>
              <div className="flex items-center gap-2 mb-2">
                {periodSummary.overall.net_profit >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                <h3 className="text-sm font-semibold opacity-90">Net Profit</h3>
              </div>
              <p className="text-3xl font-black">Rs. {periodSummary.overall.net_profit.toLocaleString()}</p>
              <p className="text-sm opacity-80 mt-2">After expenses</p>
            </div>

            {/* Total Expenses */}
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-6 rounded-3xl shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5" />
                <h3 className="text-sm font-semibold opacity-90">Total Expenses</h3>
              </div>
              <p className="text-3xl font-black">Rs. {periodSummary.expense_summary.total_expenses.toLocaleString()}</p>
              <p className="text-sm opacity-80 mt-2">{periodSummary.expense_summary.expense_count} transactions</p>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sales & Profit Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4">Sales Breakdown</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Sales Count</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{periodSummary.sales_summary.total_sales_count}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Quantity Sold</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{periodSummary.sales_summary.total_quantity_sold.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Cost of Goods</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">Rs. {periodSummary.sales_summary.total_cost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Expense & Income Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4">Expense Breakdown</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Expenses</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">Rs. {periodSummary.expense_summary.total_expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Income</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {periodSummary.expense_summary.total_income.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Net Expense</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Rs. {periodSummary.expense_summary.net_expense.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Credit/Debit Summary */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="text-indigo-500" />
                <h2 className="text-lg font-bold">Payment Methods</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Credit Sales</span>
                    <p className="text-sm text-gray-500">{periodSummary.credit_debit.credit_count} transactions</p>
                  </div>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Rs. {periodSummary.credit_debit.total_credit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Cash Sales</span>
                    <p className="text-sm text-gray-500">{periodSummary.credit_debit.cash_count} transactions</p>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {periodSummary.credit_debit.total_cash.toLocaleString()}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Credit Percentage</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{periodSummary.credit_debit.credit_percentage}%</p>
                </div>
              </div>
            </div>

            {/* Daily Trend Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-green-500" />
                <h2 className="text-lg font-bold">Daily Trend</h2>
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={periodSummary.daily_breakdown.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: any) => `Rs. ${Number(value).toLocaleString()}`}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Best Selling Products (existing) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-6">
                <Award className="text-yellow-500" />
                <h2 className="text-lg font-bold">Best Selling Products (Qty)</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#F9FAFB' }}
                      formatter={(value: any) => value.toLocaleString()}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="sales" fill="#10B981" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Company */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="text-indigo-500" />
                <h2 className="text-lg font-bold">Revenue by Company</h2>
              </div>
              <div className="h-[300px] w-full flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={companyPerformance}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {companyPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `Rs. ${Number(value).toLocaleString()}`}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-1/2 space-y-2">
                  {companyPerformance.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-gray-500 truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Select a period to view financial reports</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
