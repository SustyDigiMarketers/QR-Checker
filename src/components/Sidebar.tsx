import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Layers, 
  FolderTree, 
  QrCode, 
  ClipboardCheck, 
  Database, 
  Settings, 
  User, 
  LogOut,
  Sparkles,
  Building,
  TableProperties,
  Calendar,
  Users
} from 'lucide-react';
import { User as UserType } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserType | null;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, currentUser, onLogout }: SidebarProps) {
  let menuItems: { id: string; label: string; icon: any }[] = [];

  if (currentUser?.role === 'Super Admin') {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'organizations', label: 'Organizations', icon: Building },
      { id: 'reports', label: 'Reports', icon: TableProperties },
      { id: 'audit-logs', label: 'Audit Logs', icon: Database },
      { id: 'profile', label: 'Profile', icon: User },
    ];
  } else {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'facilities', label: 'Facilities', icon: Building2 },
      { id: 'qrcodes', label: 'QR Codes', icon: QrCode },
      { id: 'assignments', label: 'Assignments', icon: Calendar },
      { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
      { id: 'reports', label: 'Reports', icon: TableProperties },
      { id: 'inspectors', label: 'Inspectors', icon: Users },
      { id: 'profile', label: 'Profile', icon: User },
    ];
  }

  return (
    <aside className="w-full lg:w-64 bg-white border-r border-[#E9E5DE] flex flex-col justify-between shadow-xs" id="sidebar-panel">
      {/* Upper Content */}
      <div className="flex flex-col gap-6 py-6 px-4">
        {/* Brand/System Logo */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-[#2E7D32] flex items-center justify-center shadow-md shadow-[#2E7D32]/10 flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-sm text-[#1F2937] tracking-tight leading-none uppercase">CleanCheck</h1>
            <p className="text-[10px] text-gray-500 font-medium tracking-wide mt-1 uppercase">Facility Inspections</p>
          </div>
        </div>

        {/* User Quick Info */}
        {currentUser && (
          <div className="bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 flex items-center gap-3" id="sidebar-user-badge">
            <img 
              src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop"} 
              alt={currentUser.fullName}
              className="w-10 h-10 rounded-full border border-white shadow-sm object-cover"
            />
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-[#1F2937] truncate">{currentUser.fullName}</p>
              <span className="inline-block bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider mt-0.5">
                {currentUser.role}
              </span>
            </div>
          </div>
        )}

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-1" id="sidebar-navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  isActive 
                    ? 'bg-[#2E7D32] text-white shadow-sm' 
                    : 'text-[#4B5563] hover:bg-[#FAFAF8] hover:text-[#1F2937]'
                }`}
                id={`nav-link-${item.id}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Content */}
      <div className="p-4 border-t border-[#E9E5DE] bg-[#FAFAF8]">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all group"
          id="logout-btn"
        >
          <span className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-red-500 group-hover:scale-95 transition-transform" />
            <span>Sign Out Session</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
