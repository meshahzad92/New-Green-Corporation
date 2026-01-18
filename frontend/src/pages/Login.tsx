
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Sprout } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError('Incorrect identifier or password. Please verify your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-500">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl shadow-slate-200 dark:shadow-black/50 overflow-hidden border border-white dark:border-slate-800 animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-emerald-600 p-12 text-white text-center relative overflow-hidden">
          {/* Decorative background shape */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl"></div>

          <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl backdrop-blur-md">
            <Sprout className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">AgriManage Pro</h1>
          <p className="text-emerald-100 mt-2 font-medium opacity-80">Premium Agricultural Inventory System</p>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-sm border border-rose-100 dark:border-rose-900/30 font-bold animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Merchant ID</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-slate-900 dark:text-white"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Access Pin</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-slate-900 dark:text-white"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 px-4 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all active:scale-[0.98] tracking-widest uppercase mt-4"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
