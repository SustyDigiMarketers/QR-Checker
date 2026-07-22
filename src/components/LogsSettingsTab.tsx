import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Settings, 
  History, 
  CloudLightning, 
  Send, 
  Check, 
  RefreshCw, 
  Loader2, 
  UserCheck, 
  Key, 
  Mail, 
  Tag, 
  Globe,
  Server,
  Cpu,
  Activity,
  HardDrive
} from 'lucide-react';
import { AppSettings, AuditLog, Inspection } from '../types';

interface LogsSettingsTabProps {
  settings: AppSettings | null;
  auditLogs: AuditLog[];
  inspections: Inspection[];
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onTriggerSheetsSync?: () => Promise<{ success: boolean; syncedCount: number; sheetId: string }>;
  isProcessing: boolean;
  currentUserRole: string;
  initialPanelMode?: 'settings' | 'audit' | 'system';
}

export default function LogsSettingsTab({
  settings,
  auditLogs,
  inspections,
  onUpdateSettings,
  onTriggerSheetsSync,
  isProcessing,
  currentUserRole,
  initialPanelMode
}: LogsSettingsTabProps) {

  // Dynamic panel selector: 'settings' | 'audit' | 'system'
  const [panelMode, setPanelMode] = useState<'settings' | 'audit' | 'system'>(initialPanelMode || 'settings');

  // Safe array guards
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
  const safeInspections = Array.isArray(inspections) ? inspections : [];

  // SMTP Settings form states
  const [companyName, setCompanyName] = useState(settings?.companyName || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(settings?.companyLogoUrl || '');
  const [smtpHost, setSmtpHost] = useState(settings?.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(settings?.smtpPort || '');
  const [smtpUser, setSmtpUser] = useState(settings?.smtpUser || '');

  // System Health and Backup States
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [backups, setBackups] = useState<string[]>([]);
  const safeBackups = Array.isArray(backups) ? backups : [];
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchSystemHealthAndBackups = async () => {
    setLoadingHealth(true);
    try {
      const token = localStorage.getItem('sessionToken') || '';
      const headers = { 'Authorization': `Bearer ${token}` };

      const healthRes = await fetch('/api/admin/system-health', { headers });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setSystemHealth(healthData);
      }

      const backupRes = await fetch('/api/admin/backups', { headers });
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        setBackups(backupData.backups || []);
      }
    } catch (err) {
      console.error('[System Health] Error fetching stats:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (panelMode === 'system') {
      fetchSystemHealthAndBackups();
    }
  }, [panelMode]);

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const token = localStorage.getItem('sessionToken') || '';
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        alert('Database backup file successfully saved on production server disk!');
        fetchSystemHealthAndBackups();
      } else {
        const data = await res.json();
        alert(`Backup failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Backup error: ${err.message || err}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Are you absolutely sure you want to restore backup file: ${filename}? This will overwrite current production collections!`)) {
      return;
    }
    setRestoring(filename);
    try {
      const token = localStorage.getItem('sessionToken') || '';
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        alert('Staging / Production MongoDB database state successfully restored!');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Restore failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Restore error: ${err.message || err}`);
    } finally {
      setRestoring(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateSettings({
        companyName,
        companyLogoUrl,
        smtpHost,
        smtpPort,
        smtpUser
      });
      alert("System configuration updated successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="logs-settings-tab-panel">
      
      {/* Sub tabs navigation */}
      <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-1 shadow-2xs self-start" id="logs-tabs-row">
        <button
          onClick={() => setPanelMode('settings')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            panelMode === 'settings' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Global SMTP &amp; Logo Settings
        </button>
        <button
          onClick={() => setPanelMode('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            panelMode === 'audit' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Security Audit Logs
        </button>
        <button
          onClick={() => setPanelMode('system')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            panelMode === 'system' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          System Health &amp; Backup Engine
        </button>
      </div>

      {/* 2. GENERAL SETTINGS */}
      {panelMode === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-6 max-w-xl animate-fade-in" id="global-settings-form">
          <h3 className="font-extrabold text-[#1F2937] text-base uppercase tracking-tight pb-3 border-b border-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Global Facility Settings
          </h3>

          <div className="grid grid-cols-1 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">Company Name</label>
              <input
                required
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-bold text-[#1F2937]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">Brand Logo URL</label>
              <input
                type="url"
                value={companyLogoUrl}
                onChange={(e) => setCompanyLogoUrl(e.target.value)}
                className="w-full bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-mono text-[#1F2937]"
              />
            </div>

            <div className="border-t border-gray-100 pt-4 mt-2">
              <h4 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Outgoing SMTP Mail Configuration
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">SMTP Server Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.mailgun.org"
                    className="w-full bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none text-xs font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">Port</label>
                  <input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-full bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none text-xs font-bold text--[#1F2937]"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wide mb-1.5">SMTP User Username</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="postmaster@domain.com"
                    className="w-full bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none text-xs text-[#1F2937]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4 mt-2">
            <button
              type="submit"
              className="px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              Save Configuration Settings
            </button>
          </div>
        </form>
      )}

      {/* 3. AUDIT LOGS SECURITY HISTORY */}
      {panelMode === 'audit' && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl shadow-xs overflow-hidden animate-fade-in" id="audit-logs-table-panel">
          <div className="p-5 border-b border-gray-100 bg-[#FAFAF8]">
            <h3 className="font-extrabold text-[#1F2937] text-sm uppercase tracking-wide flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-gray-400" />
              Security Audit Trails
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">Immutable ledger tracking account operations, master data changes, and compliance logins.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="audit-logs-table">
              <thead>
                <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-6">Event Type / Action</th>
                  <th className="py-3 px-6">Operator User</th>
                  <th className="py-3 px-6">Details Ledger</th>
                  <th className="py-3 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-500">
                {safeAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      No audit events recorded in database.
                    </td>
                  </tr>
                ) : (
                  safeAuditLogs.map((log, index) => (
                    <tr key={log.id || `audit-log-${index}`} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-3.5 px-6 font-extrabold text-[#1F2937]">
                        <span className="inline-block bg-gray-100 border border-gray-200 text-gray-700 font-bold text-[9px] px-2 py-0.5 rounded-md">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-semibold flex items-center gap-1.5 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                        <span>{log.username} ({log.userId})</span>
                      </td>
                      <td className="py-3.5 px-6 italic text-gray-400 truncate max-w-sm" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono text-[10px] text-gray-400 font-bold">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SYSTEM HEALTH & BACKUPS */}
      {panelMode === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="system-health-panel">
          {/* Health Stats */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs">
              <h3 className="font-extrabold text-[#1F2937] text-sm uppercase tracking-wider pb-3 border-b border-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-green-600" />
                  Staging / Production System Metrics
                </span>
                <button 
                  onClick={fetchSystemHealthAndBackups} 
                  disabled={loadingHealth}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-all"
                  title="Refresh metrics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                </button>
              </h3>

              {loadingHealth && !systemHealth ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  <span className="text-[10px] uppercase font-extrabold text-gray-400">Loading metrics...</span>
                </div>
              ) : systemHealth ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-xs text-gray-600">
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center gap-3">
                    <Server className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Environment Runtime</p>
                      <p className="font-bold text-[#1F2937] mt-0.5">Node.js {systemHealth.runtimeVersion || 'v18'}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">Uptime: {Math.floor(systemHealth.uptime / 3600) || 0}h {Math.floor((systemHealth.uptime % 3600) / 60) || 0}m</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center gap-3">
                    <Database className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">MongoDB Datastore</p>
                      <p className="font-bold text-green-700 mt-0.5">{systemHealth.database?.enabled ? 'Online (Atlas Pool)' : 'Offline Fallback'}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">Collections: {systemHealth.database?.collectionsCount || 0} | Size: {systemHealth.database?.dbSizeHuman || '0 KB'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center gap-3">
                    <Cpu className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">CPU Allocation &amp; Core Load</p>
                      <p className="font-bold text-[#1F2937] mt-0.5">User: {Math.round(systemHealth.cpu?.user / 1000) || 0}ms</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">System Usage: {Math.round(systemHealth.cpu?.system / 1000) || 0}ms</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center gap-3">
                    <HardDrive className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">RAM / Heap Consumption</p>
                      <p className="font-bold text-[#1F2937] mt-0.5">RSS: {systemHealth.memory?.rss || '0 MB'}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">Heap Used: {systemHealth.memory?.heapUsed || '0 MB'} of {systemHealth.memory?.heapTotal || '0 MB'}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 bg-gray-50 border border-gray-100 p-4 rounded-xl mt-1">
                    <h4 className="font-bold text-gray-700 mb-2 uppercase text-[9px] tracking-widest">Active Database Collections Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      {systemHealth.database?.collections && Object.entries(systemHealth.database.collections).map(([name, count]: any) => (
                        <div key={name} className="bg-white p-2 border border-gray-200 rounded-lg flex flex-col">
                          <span className="font-mono text-gray-500 truncate">{name}</span>
                          <span className="font-extrabold text-[#1F2937] text-xs mt-0.5">{count} docs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-10 uppercase tracking-wider text-[10px] font-bold">Failed to connect to monitoring agent.</p>
              )}
            </div>
          </div>

          {/* Backup Management */}
          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
            <div>
              <h3 className="font-extrabold text-[#1F2937] text-sm uppercase tracking-wide flex items-center gap-2 pb-2 border-b border-gray-100">
                <Database className="w-4.5 h-4.5 text-[#2E7D32]" />
                Backup &amp; Recovery
              </h3>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                Take snapshot backups of MongoDB collections. Saved securely on the production server volume. Recover database status instantly.
              </p>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={backingUp}
              className="w-full py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {backingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Snapshot...
                </>
              ) : (
                'Create DB Snapshot'
              )}
            </button>

            <div className="border-t border-gray-100 pt-4 flex-1">
              <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Available Snapshots</h4>
              {safeBackups.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                  No backups found on server.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {safeBackups.map((bk, i) => (
                    <div key={bk || i} className="bg-[#FAFAF8] border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs gap-2">
                      <div className="truncate flex-1">
                        <p className="font-bold text-[#1F2937] truncate font-mono text-[10px]" title={bk}>{bk}</p>
                      </div>
                      <button
                        onClick={() => handleRestoreBackup(bk)}
                        disabled={restoring !== null}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-bold rounded-lg text-[9px] uppercase tracking-wide transition-all shrink-0 flex items-center gap-1"
                      >
                        {restoring === bk ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Restore'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
