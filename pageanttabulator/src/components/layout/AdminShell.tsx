import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, UserCheck, FileText, Trophy } from 'lucide-react';
import { cn } from '../ui/Button';

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Setup', path: '/', icon: Trophy },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Candidates', path: '/candidates', icon: Users },
    { label: 'Criteria', path: '/criteria', icon: ClipboardList },
    { label: 'Judge Status', path: '/judges', icon: UserCheck },
    { label: 'Reports', path: '/reports', icon: FileText },
  ];

  return (
    <div className="flex h-screen w-full bg-parchment overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-primary-900 text-white flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="display-font text-xl font-bold leading-tight">Pageant<br/><span className="text-gold-500">Tabulator</span></h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-150',
                  isActive 
                    ? 'bg-primary-800 text-white border-l-4 border-gold-500'
                    : 'text-neutral-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-gold-500' : 'text-primary-500')} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10 text-xs text-neutral-400">
          Admin Mode
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-neutral-200 bg-white flex items-center px-8 justify-between shadow-sm z-10">
          <div className="font-medium text-neutral-900">Mr. & Ms. IDSC 2026</div>
          <div className="text-sm text-neutral-500">Local IP: 192.168.x.x:3000</div>
        </header>
        
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};
