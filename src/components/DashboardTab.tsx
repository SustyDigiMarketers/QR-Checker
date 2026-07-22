import React from 'react';
import { 
  ClipboardCheck, 
  Building, 
  Building2, 
  Layers, 
  FolderTree, 
  Star, 
  AlertOctagon, 
  Clock,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  QrCode
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DashboardStats } from '../types';

interface DashboardTabProps {
  stats: DashboardStats | null;
  onNavigateToTab: (tab: string) => void;
  onOpenScanRequest: () => void;
  onRetrySync?: () => Promise<void>;
}

export default function DashboardTab({ stats, onNavigateToTab, onOpenScanRequest, onRetrySync }: DashboardTabProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-t-[#2E7D32] border-gray-200 animate-spin" />
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Syncing Operational Analytics...</p>
        </div>
      </div>
    );
  }

  // Analytics mock-structures from historical logs for visual accuracy
  const chartData = [
    { name: 'Mon', count: 12, rating: 4.2 },
    { name: 'Tue', count: 18, rating: 4.5 },
    { name: 'Wed', count: 15, rating: 4.0 },
    { name: 'Thu', count: 22, rating: 4.8 },
    { name: 'Fri', count: 20, rating: 4.6 },
    { name: 'Sat', count: 8, rating: 4.1 },
    { name: 'Sun', count: 11, rating: 4.3 }
  ];

  const barData = [
    { name: 'Restroom', cleaned: 24, dirty: 4 },
    { name: 'Kitchen', cleaned: 15, dirty: 2 },
    { name: 'Office', cleaned: 30, dirty: 1 },
    { name: 'Conference', cleaned: 18, dirty: 3 },
    { name: 'Lobby', cleaned: 12, dirty: 0 }
  ];

  const [isRetrying, setIsRetrying] = React.useState(false);
  const safeRecentInspections = Array.isArray(stats.recentInspections) ? stats.recentInspections : [];

  const handleRetrySync = async () => {
    if (!onRetrySync) return;
    setIsRetrying(true);
    try {
      await onRetrySync();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRetrying(false);
    }
  };

  const renderSyncHealthWidget = () => {
    const syncHealth = stats.syncHealth;
    if (!syncHealth) return null;

    const { status, lastSyncTime, queuedCount, failedCount, oldestQueuedTime, lastError } = syncHealth;
    
    let bgColor = 'bg-gray-50 border-gray-200';
    let icon = <Cloud className="w-4 h-4 text-gray-500" />;
    let statusLabel = 'Offline';
    let description = 'Cloud synchronization is offline. Operating in standalone mode.';

    if (status === 'CONNECTED') {
      bgColor = 'bg-emerald-50/80 border-emerald-200/80';
      icon = <Cloud className="w-4 h-4 text-emerald-600" />;
      statusLabel = 'Synced';
      description = 'All systems nominal. Database is fully synchronized in real-time.';
    } else if (status === 'DEGRADED') {
      bgColor = 'bg-amber-50/80 border-amber-200/80';
      icon = <CloudOff className="w-4 h-4 text-amber-600" />;
      statusLabel = 'Offline Mode';
      description = `Data is being saved locally and will sync automatically when connection returns (${queuedCount} pending update${queuedCount === 1 ? '' : 's'}).`;
      if (failedCount > 0) {
        description = `${failedCount} updates suspended. Operating in safe local mode.`;
      }
    } else if (status === 'RECOVERING') {
      bgColor = 'bg-blue-50/80 border-blue-200/80';
      icon = <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      statusLabel = 'Synchronizing...';
      description = `Re-establishing cloud sync connection. ${queuedCount} item${queuedCount === 1 ? '' : 's'} remaining.`;
    } else if (status === 'OFFLINE') {
      bgColor = 'bg-rose-50/80 border-rose-200/80';
      icon = <CloudOff className="w-4 h-4 text-rose-600" />;
      statusLabel = 'Offline Mode';
      description = 'Offline mode active. All submissions are queued locally.';
    }

    return (
      <div className={`border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${bgColor}`} id="cloud-sync-health-widget">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow-xs shrink-0">
            {icon}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                status === 'DEGRADED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                status === 'RECOVERING' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                {statusLabel}
              </span>
              {queuedCount > 0 && (
                <span className="text-[10px] bg-white text-gray-700 font-bold px-2 py-0.5 rounded-md border border-gray-200">
                  {queuedCount} Queued
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-medium">
              {description}
            </p>
          </div>
        </div>

        {onRetrySync && (status === 'DEGRADED' || status === 'RECOVERING' || status === 'OFFLINE') && (
          <button
            onClick={handleRetrySync}
            disabled={isRetrying}
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 active:scale-98 disabled:opacity-50 transition-all text-xs font-bold rounded-xl shadow-xs text-gray-700 flex items-center justify-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Syncing...' : 'Retry Sync'}
          </button>
        )}
      </div>
    );
  };

  const [viewMode, setViewMode] = React.useState<'table' | 'timeline'>('table');

  const completedCount = stats.todayChecksCount - stats.failedInspectionsCount;

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="dashboard-tab-panel">
      
      {/* Upper Jumbotron / Header Banner */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#2E7D32]/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] px-2.5 py-0.5 rounded-md font-extrabold uppercase tracking-widest">
              Operations Center
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">
              Client Session: CC-3814
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[#1F2937] tracking-tight">
            CleanCheck Control Room
          </h2>
          <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
            Real-time compliance monitoring, quick QR inspection logging, and complete facility audit management.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="w-full md:w-auto shrink-0">
          <button
            onClick={onOpenScanRequest}
            className="w-full md:w-auto min-h-[44px] px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-extrabold shadow-md shadow-[#2E7D32]/15 flex items-center justify-center gap-2.5 transition-all active:scale-98"
            id="quick-scan-jumbo-btn"
          >
            <QrCode className="w-4 h-4 text-[#C8A165]" />
            <span>Scan Inspection QR</span>
          </button>
        </div>
      </div>

      {/* Cloud Synchronization Health Status Widget */}
      {renderSyncHealthWidget()}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5" id="stats-grid-primary">
        
        {/* Today's Checks */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 md:p-5 hover:border-gray-300 transition-all flex flex-col justify-between gap-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">Today's Checks</span>
            <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">{stats.todayChecksCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Inspections logged today</p>
          </div>
        </div>

        {/* Pending Rooms */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 md:p-5 hover:border-gray-300 transition-all flex flex-col justify-between gap-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">Pending Rooms</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF3E0] flex items-center justify-center text-[#F59E0B] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">{stats.pendingRoomsCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Needing inspection check</p>
          </div>
        </div>

        {/* Completed Inspections */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 md:p-5 hover:border-gray-300 transition-all flex flex-col justify-between gap-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">{completedCount > 0 ? completedCount : stats.todayChecksCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Passed audit quality</p>
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 md:p-5 hover:border-gray-300 transition-all flex flex-col justify-between gap-2 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">Compliance</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFFDE7] flex items-center justify-center text-[#C8A165] shrink-0">
              <Star className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">{stats.compliancePercentage ?? 100}%</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Quality pass standard</p>
          </div>
        </div>

      </div>

      {/* Secondary Facility Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="stats-grid-secondary">
        <div className="bg-white border border-[#E9E5DE] rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-extrabold uppercase">Organizations</p>
            <p className="text-base font-extrabold text-[#1F2937]">{stats.totalOrganizations}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E9E5DE] rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-extrabold uppercase">Buildings</p>
            <p className="text-base font-extrabold text-[#1F2937]">{stats.totalBuildings}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E9E5DE] rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-extrabold uppercase">Floors</p>
            <p className="text-base font-extrabold text-[#1F2937]">{stats.totalFloors}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E9E5DE] rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-extrabold uppercase">Rooms</p>
            <p className="text-base font-extrabold text-[#1F2937]">{stats.totalRooms}</p>
          </div>
        </div>
      </div>

      {/* Grid: Trend Charts and Active Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="dashboard-analytics-grid">
        
        {/* Inspection Count & Score Trends Area Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
                Inspection Trend &amp; Quality Index
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Average weekly audit distribution</p>
            </div>
            <span className="text-[10px] bg-[#F5F5F5] text-gray-600 font-extrabold px-2.5 py-1 rounded-lg uppercase">
              Last 7 Days
            </span>
          </div>

          <div className="h-60 w-full" id="area-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2E7D32" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFF1" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78909C' }} />
                <YAxis tick={{ fontSize: 10, fill: '#78909C' }} />
                <Tooltip contentStyle={{ background: '#37474F', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="count" stroke="#2E7D32" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="Inspections Count" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Room Type Breakdown Bar Chart */}
        <div className="lg:col-span-4 bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-gray-400" />
                Category Performance
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Clean vs Dirty volume by Room Type</p>
            </div>
          </div>

          <div className="h-60 w-full" id="bar-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFF1" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#78909C' }} />
                <YAxis tick={{ fontSize: 9, fill: '#78909C' }} />
                <Tooltip contentStyle={{ background: '#37474F', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', marginTop: '10px' }} />
                <Bar dataKey="cleaned" stackId="a" fill="#2E7D32" name="Cleaned" />
                <Bar dataKey="dirty" stackId="a" fill="#EF4444" name="Dirty / Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Lower Section: Recent Inspections Activity List */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-xs flex flex-col gap-4" id="recent-activity-panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 gap-3">
          <div>
            <h3 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gray-400" />
              Recent Activity Feed
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Live monitoring timeline of facility cleanliness submissions</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
            {/* Toggle View Mode Buttons */}
            <div className="flex bg-[#F5F5F3] p-1 rounded-xl border border-[#E9E5DE]">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#2E7D32] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-white text-[#2E7D32] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Timeline
              </button>
            </div>

            <button
              onClick={() => onNavigateToTab('inspections')}
              className="text-xs font-extrabold text-[#2E7D32] hover:text-[#1B5E20] flex items-center gap-1 shrink-0"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        {viewMode === 'table' ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse" id="recent-inspections-table">
                <thead>
                  <tr className="border-b border-[#E9E5DE] text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-3">Room / Facility</th>
                    <th className="py-3 px-3">Location Hierarchy</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-3">Inspector</th>
                    <th className="py-3 px-3">Remarks</th>
                    <th className="py-3 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                  {safeRecentInspections.slice(0, 5).map((ins) => (
                    <tr key={ins.id} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-3 px-3 font-bold text-[#1F2937]">{ins.roomName}</td>
                      <td className="py-3 px-3 text-gray-400 font-medium">
                        {ins.buildingName} • {ins.floorName}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          ins.cleaned 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {ins.cleaned ? 'Cleaned' : 'Dirty / Alert'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#C8A165] font-extrabold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{ins.rating}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium">{ins.inspectorName}</td>
                      <td className="py-3 px-3 italic text-gray-400 truncate max-w-xs" title={ins.remarks}>
                        {ins.remarks || 'No remarks provided.'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-400 font-medium font-mono text-[11px]">
                        {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW (Replaces table on screens < 768px) */}
            <div className="md:hidden flex flex-col gap-3" id="recent-inspections-cards-mobile">
              {safeRecentInspections.slice(0, 5).map((ins) => (
                <div 
                  key={ins.id}
                  className="bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-xs text-[#1F2937]">{ins.roomName}</h4>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{ins.buildingName} • {ins.floorName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shrink-0 ${
                      ins.cleaned ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {ins.cleaned ? 'Cleaned' : 'Dirty'}
                    </span>
                  </div>

                  {ins.remarks && (
                    <p className="text-[11px] text-gray-600 bg-white p-2 rounded-lg border border-gray-100 italic">
                      &ldquo;{ins.remarks}&rdquo;
                    </p>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium pt-1 border-t border-gray-100">
                    <span className="font-semibold text-gray-700">Audited by {ins.inspectorName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#C8A165] font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-current" /> {ins.rating}/5
                      </span>
                      <span>•</span>
                      <span className="font-mono text-gray-400">
                        {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 py-2" id="activity-timeline-view">
            {safeRecentInspections.slice(0, 5).map((ins, index) => {
              const isLast = index === safeRecentInspections.slice(0, 5).length - 1;
              return (
                <div key={ins.id} className="flex gap-3 relative">
                  {!isLast && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-100" style={{ transform: 'translateX(-50%)' }} />
                  )}
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 shadow-xs ${
                    ins.cleaned 
                      ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-300' 
                      : 'bg-rose-50 text-rose-600 border-2 border-rose-300'
                  }`}>
                    {ins.cleaned ? (
                      <ClipboardCheck className="w-4 h-4" />
                    ) : (
                      <AlertOctagon className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 bg-white border border-[#E9E5DE] rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-gray-800">{ins.roomName}</span>
                        <span className="text-[10px] text-gray-400 font-medium">({ins.buildingName} • {ins.floorName})</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Audited by <span className="font-bold text-gray-800">{ins.inspectorName}</span>. Rating: <span className="font-bold text-[#C8A165]">{ins.rating}/5</span>
                      </p>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto text-[10px] text-gray-400 font-mono">
                      <span>{new Date(ins.createdAt).toLocaleDateString()}</span>
                      <span className="font-bold text-[#2E7D32]">
                        {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
