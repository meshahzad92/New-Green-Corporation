import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, StickyNote, Database, ArrowRight, Sparkles, ShieldCheck, FileSpreadsheet } from 'lucide-react';

const MoreHub: React.FC = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'Financial & Sales Reports',
      description: 'Comprehensive financial analytics, revenue breakdowns, profit margins, expense analysis, and downloadable audit reports.',
      icon: BarChart3,
      path: '/reports',
      color: 'from-blue-600 to-cyan-600',
      badge: 'Analytics',
      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
    },
    {
      title: 'Target Notes & To-Do',
      description: 'Daily shop objectives, target-achieving pin bar, scheduled customer follow-ups, and categorized task tracking.',
      icon: StickyNote,
      path: '/notes',
      color: 'from-amber-500 to-orange-600',
      badge: 'Productivity',
      badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
    },
    {
      title: 'Database Backup & Restore',
      description: 'Export complete database snapshots in secure JSON format and restore system data with automated foreign-key validation.',
      icon: Database,
      path: '/backup',
      color: 'from-emerald-600 to-teal-600',
      badge: 'Security',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Tools & Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Access business reports, scheduled target notes, and database backups
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <div
            key={tool.path}
            onClick={() => navigate(tool.path)}
            className="group cursor-pointer bg-white dark:bg-slate-800 rounded-3xl p-7 border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.color} text-white flex items-center justify-center shadow-lg shadow-emerald-900/10 group-hover:scale-110 transition-transform duration-300`}>
                  <tool.icon className="w-7 h-7" />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${tool.badgeColor}`}>
                  {tool.badge}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {tool.title}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mt-2.5">
                {tool.description}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <span>Open Tool</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoreHub;
