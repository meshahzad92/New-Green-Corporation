
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Building2,
  Package,
  Layers,
  ShoppingCart,
  Wallet,
  Receipt,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  Sprout,
  Menu,
  X,
  MoreVertical
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/companies', label: 'Companies', icon: Building2 },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/stock', label: 'Stock', icon: Layers },
  { path: '/sales', label: 'Sales', icon: ShoppingCart },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const sidebarContent = (
    <div className="h-full flex flex-col bg-emerald-900 dark:bg-slate-900 text-white transition-colors duration-300">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-400 rounded-xl flex items-center justify-center text-emerald-900 font-bold shadow-lg shadow-emerald-400/20">
          <Sprout className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight">AgriManage</span>
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Pro Edition</span>
        </div>
      </div>

      <nav className="flex-1 mt-4 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group
              ${isActive
                ? 'bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-emerald-100/70 hover:bg-white/5 hover:text-white'}
            `}
          >
            <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110`} />
            <span className="text-sm tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 space-y-2 border-t border-white/10">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-4 w-full px-4 py-3 text-emerald-100/70 hover:bg-white/5 hover:text-white rounded-2xl transition-all duration-300"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span className="text-sm tracking-wide">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-4 w-full px-4 py-3 text-emerald-100/70 hover:bg-red-500/10 hover:text-red-300 rounded-2xl transition-all duration-300 group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm tracking-wide">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-emerald-900 dark:bg-slate-900 flex items-center justify-between px-6 z-50 text-white">
        <div className="flex items-center gap-2">
          <Sprout className="w-6 h-6 text-emerald-400" />
          <span className="font-black text-sm uppercase tracking-tighter">AgriManage</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          {isOpen ? <X className="w-6 h-6" /> : <MoreVertical className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden lg:flex w-64 h-screen flex-col fixed left-0 top-0 z-50">
        {sidebarContent}
      </div>

      {/* Sidebar Mobile Overlay - Covers everything including top bar */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm" onClick={toggleSidebar} />
      )}

      {/* Mobile Sidebar Content - Above overlay */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-64 z-[70] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
