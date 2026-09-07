import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, UserCheck, FileText, Trophy, QrCode, X, Copy, Activity } from 'lucide-react';
import { cn } from '../ui/Button';
import { useAppContext } from '../../context/AppContext';
import { fetchApi } from '../../api/client';
import { QRCodeSVG } from 'qrcode.react';

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { state } = useAppContext();
  const [networkInfo, setNetworkInfo] = React.useState<any>(null);
  const [showQrModal, setShowQrModal] = React.useState(false);

  React.useEffect(() => {
    fetchApi('/api/network-info')
      .then(info => setNetworkInfo(info))
      .catch(err => console.error('Failed to load network info', err));
  }, []);

  const navItems = [
    { label: 'Setup', path: '/', icon: Trophy },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Candidates', path: '/candidates', icon: Users },
    { label: 'Criteria', path: '/criteria', icon: ClipboardList },
    { label: 'Judge Status', path: '/judges', icon: UserCheck },
    { label: 'Results', path: '/results', icon: Trophy },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'History', path: '/history', icon: ClipboardList },
    { label: 'Diagnostics', path: '/diagnostics', icon: Activity },
  ];

  return (
    <div className="flex h-screen w-full bg-parchment print:bg-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-primary-900 text-white flex flex-col shrink-0 print:hidden">
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto print:overflow-visible">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-neutral-200 bg-white flex items-center px-8 justify-between shadow-sm z-10 print:hidden">
          <div className="font-semibold text-neutral-900">
            {state.eventConfig?.name || 'Pageant Tabulator'}
            {state.eventConfig?.subtitle && (
              <span className="text-neutral-400 font-normal ml-2">| {state.eventConfig.subtitle}</span>
            )}
          </div>
          
          {networkInfo && (
            <button 
              onClick={() => setShowQrModal(true)}
              className="flex items-center space-x-2 bg-primary-100 hover:bg-primary-200 text-primary-900 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-success"></div>
              <span>LAN: {networkInfo.localIp}:{networkInfo.port}</span>
              <QrCode className="w-4 h-4 ml-1 opacity-70" />
            </button>
          )}
        </header>
        
        <div className="flex-1">
          {children}
        </div>
      </main>

      {/* QR Code Modal */}
      {showQrModal && networkInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-modal p-8 max-w-sm w-full relative">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-heading-3 text-center mb-2">Connect Judges</h2>
            <p className="text-sm text-neutral-500 text-center mb-6">
              Scan this QR code with a tablet or phone to access the judge portal.
            </p>
            
            <div className="flex justify-center mb-6 bg-white p-4 rounded-lg border border-neutral-100 shadow-sm">
              <QRCodeSVG value={networkInfo.judgeUrl} size={200} />
            </div>
            
            <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <div className="text-sm font-medium truncate mr-3">{networkInfo.judgeUrl}</div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(networkInfo.judgeUrl);
                }}
                className="p-2 hover:bg-neutral-200 rounded-md text-neutral-700 transition-colors"
                title="Copy URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
