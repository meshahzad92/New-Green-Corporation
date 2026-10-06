
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

const ProtectedRoute: React.FC = () => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-3 md:p-8 pt-[4.25rem] pb-28 lg:pt-8 lg:pb-8 overflow-auto min-w-0">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ProtectedRoute;
