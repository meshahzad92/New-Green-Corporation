
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Stock from './pages/Stock';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import Khata from './pages/Khata';
import KhataDetail from './pages/KhataDetail';
import Reports from './pages/Reports';
import Notes from './pages/Notes';
import Backup from './pages/Backup';
import MoreHub from './pages/MoreHub';
import CompanyKhata from './pages/CompanyKhata';
import CompanyKhataDetail from './pages/CompanyKhataDetail';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <HashRouter>
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
                <Route path="/more" element={<MoreHub />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/backup" element={<Backup />} />
              </Route>
            </Routes>
          </HashRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
