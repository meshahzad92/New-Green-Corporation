
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Companies = React.lazy(() => import('./pages/Companies'));
const Products = React.lazy(() => import('./pages/Products'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Stock = React.lazy(() => import('./pages/Stock'));
const Sales = React.lazy(() => import('./pages/Sales'));
const Expenses = React.lazy(() => import('./pages/Expenses'));
const Khata = React.lazy(() => import('./pages/Khata'));
const KhataDetail = React.lazy(() => import('./pages/KhataDetail'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Notes = React.lazy(() => import('./pages/Notes'));
const Backup = React.lazy(() => import('./pages/Backup'));
const MoreHub = React.lazy(() => import('./pages/MoreHub'));
const CompanyKhata = React.lazy(() => import('./pages/CompanyKhata'));
const CompanyKhataDetail = React.lazy(() => import('./pages/CompanyKhataDetail'));
const MoneyManagement = React.lazy(() => import('./pages/MoneyManagement'));
const MoneyAccountDetail = React.lazy(() => import('./pages/MoneyAccountDetail'));

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
    Loading...
  </div>
);

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <HashRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:productId" element={<ProductDetail />} />
                  <Route path="/stock" element={<Stock />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/khata" element={<Khata />} />
                  <Route path="/khata/:dealerId" element={<KhataDetail />} />
                  <Route path="/company-khata" element={<CompanyKhata />} />
                  <Route path="/company-khata/:companyId" element={<CompanyKhataDetail />} />
                  <Route path="/money" element={<MoneyManagement />} />
                  <Route path="/money/:accountId" element={<MoneyAccountDetail />} />
                  <Route path="/more" element={<MoreHub />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/backup" element={<Backup />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
