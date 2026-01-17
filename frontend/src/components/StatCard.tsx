
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'indigo';
}

const colorMap = {
  green: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
  blue: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
  yellow: 'from-amber-400 to-orange-500 shadow-amber-500/20',
  red: 'from-rose-500 to-red-600 shadow-rose-500/20',
  indigo: 'from-indigo-500 to-purple-600 shadow-indigo-500/20',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color, trend }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorMap[color]} text-white shadow-lg`}>
          <Icon className="w-7 h-7" />
        </div>
        {trend && (
          <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1.5 bg-slate-50 dark:bg-slate-700 rounded-full text-slate-400">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">{label}</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
