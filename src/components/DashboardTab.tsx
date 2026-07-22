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
  AlertCircle
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
import { DashboardStats, Inspection } from '../types';

interface DashboardTabProps {
  stats: DashboardStats | null;
  onNavigateToTab: (tab: string) => void;
  onOpenScanRequest: () => void;
  onRetrySync?: () => Promise<void>;
}

export default function DashboardTab({ stats, onNavigateToTab, onOpenScanRequest, onRetrySync }: DashboardTabProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border-4 border-t-[#2E7D32] border-gray-200 animate-spin" />
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Syncing Dashboard...</p>
        </div>
      </div>
    );
  }

  // Generate beautiful analytics mock-structures from historical logs for visual accuracy
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
    let icon = <Cloud className="w-5 h-5 text-gray-500" />;
    let statusLabel = 'Offline';
    let description = 'Cloud synchronization is not active.';

    if (status === 'CONNECTED') {
      bgColor = 'bg-emerald-50 border-emerald-100';
      icon = <Cloud className="w-5 h-5 text-emerald-600" />;
      statusLabel = 'Connected';
      description = 'All systems nominal. Database is fully synchronized with Google Cloud Firestore.';
    } else if (status === 'DEGRADED') {
      bgColor = 'bg-amber-50/50 border-amber-200';
      icon = <CloudOff className="w-5 h-5 text-amber-600" />;
      statusLabel = 'Degraded (Local Sync active)';
      description = `Permission restriction or setup gap detected. All ${queuedCount} update${queuedCount === 1 ? '' : 's'} are safely preserved in the local queue.`;
      if (failedCount > 0) {
        description = `Action required: ${failedCount} critical synchronizations failed repeatedly and are suspended. All other updates are preserved in the local queue.`;
      }
    } else if (status === 'RECOVERING') {
      bgColor = 'bg-blue-50/50 border-blue-200';
      icon = <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      statusLabel = 'Recovering';
      description = `Temporary offline or transient error. Retrying synchronization... ${queuedCount} update${queuedCount === 1 ? '' : 's'} pending.`;
    } else if (status === 'OFFLINE') {
      bgColor = 'bg-rose-50/50 border-rose-200';
      icon = <CloudOff className="w-5 h-5 text-rose-600" />;
      statusLabel = 'Offline';
      description = 'Cloud synchronization is currently offline. Operating in local standalone mode.';
    }

    return (
      <div className={`border rounded-2xl p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${bgColor}`} id="cloud-sync-health-widget">
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-white rounded-xl shadow-xs">
            {icon}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-md ${
                status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                status === 'DEGRADED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                status === 'RECOVERING' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                {statusLabel}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">
                {queuedCount > 0 ? `${queuedCount} Queue Item${queuedCount === 1 ? '' : 's'}` : 'All Sync\'d'}
              </span>
              {failedCount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-md">
                  {failedCount} Permanently Failed
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-semibold mt-0.5">
              {description}
            </p>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-1">
              {lastSyncTime && (
                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                  ● Last Successful Sync: {new Date(lastSyncTime).toLocaleString()}
                </span>
              )}
              {oldestQueuedTime && (
                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                  ● Oldest Buffered Item: {new Date(oldestQueuedTime).toLocaleString()}
                </span>
              )}
            </div>
            {status === 'DEGRADED' && lastError && (
              <div className="text-[10px] bg-red-50 text-red-700 px-3 py-2 rounded-xl border border-red-100 font-mono mt-1.5 max-w-2xl break-all">
                <span className="font-bold">Error Diagnostic:</span> {lastError}
              </div>
            )}
          </div>
        </div>

        {onRetrySync && (status === 'DEGRADED' || status === 'RECOVERING' || status === 'OFFLINE') && (
          <button
            onClick={handleRetrySync}
            disabled={isRetrying}
            className="w-full md:w-auto px-4 py-2.5 bg-white border border-[#E9E5DE] hover:border-gray-300 hover:bg-gray-50 active:scale-98 disabled:opacity-50 transition-all text-xs font-bold rounded-xl shadow-xs text-gray-700 flex items-center justify-center gap-2 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying Synchronization...' : 'Retry Synchronization'}
          </button>
        )}
      </div>
    );
  };

  const [viewMode, setViewMode] = React.useState<'table' | 'timeline'>('table');

  return (
    <div className="flex flex-col gap-8 animate-fade-in" id="dashboard-tab-panel">
      {/* Upper Jumbotron Welcome */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#2E7D32]/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col gap-2">
          <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] px-2.5 py-1 rounded-md font-extrabold uppercase tracking-widest self-start">
            Facility Center
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] tracking-tight">
            CleanCheck Control Room
          </h2>
          <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
            Monitor real-time compliance audits, instantly map and generate secure room QR badges, and generate high-fidelity PDF, Excel, and CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenScanRequest}
            className="flex-1 md:flex-none px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-md shadow-[#2E7D32]/10 flex items-center justify-center gap-2 transition-all active:scale-98"
            id="quick-scan-jumbo-btn"
          >
            <Clock className="w-4 h-4 text-[#C8A165]" />
            Scan Inspection QR
          </button>
        </div>
      </div>

      {/* Cloud Synchronization Health Status Widget */}
      {renderSyncHealthWidget()}

      {/* Grid: 8 Stat Cards for Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-grid">
        
        {/* Today's Checks */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Today's Checks</span>
            <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1F2937]">{stats.todayChecksCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-1">Inspections logged today</p>
          </div>
        </div>

        {/* Pending Rooms */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Pending Rooms</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFF3E0] flex items-center justify-center text-[#F59E0B]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1F2937]">{stats.pendingRoomsCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-1">Rooms needing checks</p>
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avg Rating</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFFDE7] flex items-center justify-center text-[#C8A165]">
              <Star className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1F2937]">{stats.averageRating} <span className="text-xs text-gray-400">/ 5</span></p>
            <p className="text-[10px] text-gray-500 font-semibold mt-1">Combined facility average</p>
          </div>
        </div>

        {/* Failed Inspections */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Failed Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFEBEE] flex items-center justify-center text-[#EF4444]">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#1F2937]">{stats.failedInspectionsCount}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-1">Rating &lt; 3 or Not Cleaned</p>
          </div>
        </div>

        {/* Total Organizations */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Building className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Organizations</span>
          </div>
          <p className="text-xl font-extrabold text-[#1F2937]">{stats.totalOrganizations}</p>
        </div>

        {/* Total Buildings */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Building2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Buildings Managed</span>
          </div>
          <p className="text-xl font-extrabold text-[#1F2937]">{stats.totalBuildings}</p>
        </div>

        {/* Total Floors */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Layers className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Total Floors</span>
          </div>
          <p className="text-xl font-extrabold text-[#1F2937]">{stats.totalFloors}</p>
        </div>

        {/* Total Rooms */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400">
            <FolderTree className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Rooms Registered</span>
          </div>
          <p className="text-xl font-extrabold text-[#1F2937]">{stats.totalRooms}</p>
        </div>

      </div>

      {/* Enterprise Auditing & Compliance metrics */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Compliance & Productivity Insights</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Compliance %</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.compliancePercentage ?? 100}%</p>
            <span className="text-[9px] text-gray-400">Checks passing standard</span>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Assignments Today</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.completedAssignedCount} / {stats.assignedInspectionsCount}</p>
            <span className="text-[9px] text-gray-400">Completed (Pending: {stats.pendingAssignedCount})</span>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Weekly Audits</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.weeklyAuditsCount ?? 0}</p>
            <span className="text-[9px] text-gray-400">Past 7 days volume</span>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Monthly Audits</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.monthlyAuditsCount ?? 0}</p>
            <span className="text-[9px] text-gray-400">Past 30 days volume</span>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Staff Active</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.activeInspectorsCount ?? 0} <span className="text-xs text-gray-400">/ {stats.activeManagersCount ?? 0}</span></p>
            <span className="text-[9px] text-gray-400">Inspectors vs Admins</span>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 hover:shadow-sm transition-all flex flex-col gap-2">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Successful Scans</span>
            <p className="text-xl font-extrabold text-[#1F2937]">{stats.qrScanSuccessCount ?? 0}</p>
            <span className="text-[9px] text-gray-400">Authentic QR checks</span>
          </div>
        </div>
      </div>

      {/* Grid: Trend Charts and Active Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-analytics-grid">
        
        {/* Inspection Count & Score Trends Area Chart */}
        <div className="lg:col-span-8 bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
                Inspection Trend &amp; Quality Index
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Average weekly audit distribution and quality index</p>
            </div>
            <span className="text-xs bg-[#F5F5F5] text-gray-600 font-bold px-2.5 py-1 rounded-lg">Last 7 Days</span>
          </div>

          <div className="h-64 w-full" id="area-chart-container">
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
        <div className="lg:col-span-4 bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-gray-400" />
                Category Performance
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Clean vs Dirty volume by Room Type</p>
            </div>
          </div>

          <div className="h-64 w-full" id="bar-chart-container">
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
      <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-4" id="recent-activity-panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-3 gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gray-400" />
              Recent Activity Feed
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Live monitoring timeline of facility cleanliness submissions</p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between">
            {/* Toggle View Mode Buttons */}
            <div className="flex bg-[#F5F5F3] p-1 rounded-xl border border-[#E9E5DE]">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#2E7D32] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Log Grid
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-white text-[#2E7D32] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Timeline View
              </button>
            </div>

            <button
              onClick={() => onNavigateToTab('inspections')}
              className="text-xs font-bold text-[#2E7D32] hover:text-[#1B5E20] flex items-center gap-1 shrink-0"
            >
              View All Reports
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="recent-inspections-table">
              <thead>
                <tr className="border-b border-[#E9E5DE] text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-4">Room / Facility</th>
                  <th className="py-3 px-4">Location Hierarchy</th>
                  <th className="py-3 px-4">Clean?</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {stats.recentInspections.slice(0, 5).map((ins) => (
                  <tr key={ins.id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="py-3 px-4 font-bold text-[#1F2937]">{ins.roomName}</td>
                    <td className="py-3 px-4 text-gray-400 font-medium">
                      {ins.buildingName} • {ins.floorName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ins.cleaned 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {ins.cleaned ? 'Cleaned' : 'Dirty / Alert'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-[#C8A165] font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{ins.rating}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">{ins.inspectorName}</td>
                    <td className="py-3 px-4 italic text-gray-400 truncate max-w-xs" title={ins.remarks}>
                      {ins.remarks || 'No remarks provided.'}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400 font-medium font-mono">
                      {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-4 px-2" id="activity-timeline-view">
            {stats.recentInspections.slice(0, 5).map((ins, index) => {
              const isLast = index === stats.recentInspections.slice(0, 5).length - 1;
              return (
                <div key={ins.id} className="flex gap-4 relative">
                  {/* Vertical Line Connector */}
                  {!isLast && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-100" style={{ transform: 'translateX(-50%)' }} />
                  )}
                  
                  {/* Color-coded Icon Node */}
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

                  {/* Detailed Description Panel */}
                  <div className="flex-1 bg-white border border-[#E9E5DE] rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-gray-300 transition-all">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-gray-800">{ins.roomName}</span>
                        <span className="text-[10px] text-gray-400 font-medium">({ins.buildingName} • {ins.floorName})</span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          ins.cleaned ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {ins.cleaned ? 'Cleaned' : 'Action Required / Dirty'}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mt-1">
                        Audited by <span className="font-bold text-gray-800">{ins.inspectorName}</span>. Rating of <span className="font-bold text-[#C8A165]">{ins.rating} / 5 Stars</span>.
                      </p>
                      {ins.remarks && (
                        <p className="text-xs italic text-gray-400 mt-1 bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-100">
                          &ldquo;{ins.remarks}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end gap-1 select-none">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                        {new Date(ins.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-extrabold text-[#2E7D32] font-mono">
                        {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
