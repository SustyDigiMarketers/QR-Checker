import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Filter, 
  RefreshCw, 
  Calendar,
  Building,
  User,
  Star,
  Layers,
  MapPin,
  ClipboardCheck,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { User as UserType, Building as BuildingType, Floor as FloorType, Room as RoomType, Organization as OrganizationType } from '../types';

interface ReportsTabProps {
  currentUser: UserType;
  buildings: BuildingType[];
  floors: FloorType[];
  rooms: RoomType[];
  organizations: OrganizationType[];
  inspectors: UserType[];
}

type ReportType = 
  | 'inspections' 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'performance' 
  | 'buildings' 
  | 'floors' 
  | 'rooms' 
  | 'qr-scans' 
  | 'audit-logs';

export default function ReportsTab({ 
  currentUser, 
  buildings, 
  floors, 
  rooms, 
  organizations, 
  inspectors 
}: ReportsTabProps) {
  const [reportType, setReportType] = useState<ReportType>('inspections');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedInspector, setSelectedInspector] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<string>('');
  const [qrToken, setQrToken] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Lock manager to their own organization
  useEffect(() => {
    if (currentUser.role === 'Organization Admin' && currentUser.organizationId) {
      setSelectedOrg(currentUser.organizationId);
    }
  }, [currentUser]);

  // Dynamic lists filtered by hierarchy
  const availableBuildings = selectedOrg 
    ? buildings.filter(b => b.organizationId === selectedOrg)
    : buildings;

  const availableFloors = selectedBuilding 
    ? floors.filter(f => f.buildingId === selectedBuilding)
    : floors;

  const availableRooms = selectedFloor 
    ? rooms.filter(r => r.floorId === selectedFloor)
    : rooms;

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams({
        reportType,
        ...(selectedOrg && { organizationId: selectedOrg }),
        ...(selectedBuilding && { buildingId: selectedBuilding }),
        ...(selectedFloor && { floorId: selectedFloor }),
        ...(selectedRoom && { roomId: selectedRoom }),
        ...(selectedInspector && { inspectorId: selectedInspector }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(selectedRating && { rating: selectedRating }),
        ...(qrToken && { qrToken }),
        ...(currentUser?.id && { userId: currentUser.id })
      });

      const token = localStorage.getItem('cleancheck_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/reports?${params.toString()}`, { headers });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch report data.');
      }
      const result = await response.json();
      setReportData(result.data || []);
    } catch (err: any) {
      console.error('[Reports] Error fetching reports:', err);
      setErrorMsg(err.message || 'An error occurred while generating the report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedOrg, selectedBuilding, selectedFloor, selectedRoom, selectedInspector, selectedStatus, startDate, endDate, selectedRating, qrToken]);

  const handleResetFilters = () => {
    if (currentUser.role === 'Super Admin') {
      setSelectedOrg('');
    }
    setSelectedBuilding('');
    setSelectedFloor('');
    setSelectedRoom('');
    setSelectedInspector('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
    setSelectedRating('');
    setQrToken('');
  };

  // Export functions
  const getExportFilename = (ext: string) => {
    const d = new Date().toISOString().split('T')[0];
    return `CleanCheck_${reportType}_Report_${d}.${ext}`;
  };

  // Header and rows builder for exports
  const getReportHeadersAndRows = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    switch (reportType) {
      case 'daily':
        headers = ['Date', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(d => [
          d.date,
          d.total,
          `${d.cleanRate}%`,
          d.avgRating,
          d.verified,
          d.rejected
        ]);
        break;
      case 'weekly':
        headers = ['Week Starting', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(w => [
          w.weekOf,
          w.total,
          `${w.cleanRate}%`,
          w.avgRating,
          w.verified,
          w.rejected
        ]);
        break;
      case 'monthly':
        headers = ['Month', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(m => [
          m.month,
          m.total,
          `${m.cleanRate}%`,
          m.avgRating,
          m.verified,
          m.rejected
        ]);
        break;
      case 'performance':
        headers = ['Inspector ID', 'Inspector Name', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(p => [
          p.inspectorId,
          p.name,
          p.total,
          `${p.cleanRate}%`,
          p.avgRating,
          p.verified,
          p.rejected
        ]);
        break;
      case 'buildings':
        headers = ['Building Name', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(b => [
          b.buildingName,
          b.total,
          `${b.cleanRate}%`,
          b.avgRating,
          b.verified,
          b.rejected
        ]);
        break;
      case 'floors':
        headers = ['Floor Location', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(f => [
          f.floorName,
          f.total,
          `${f.cleanRate}%`,
          f.avgRating,
          f.verified,
          f.rejected
        ]);
        break;
      case 'rooms':
        headers = ['Room Name', 'Total Checks', 'Clean Rate', 'Average Rating', 'Verified', 'Rejected'];
        rows = reportData.map(r => [
          r.roomName,
          r.total,
          `${r.cleanRate}%`,
          r.avgRating,
          r.verified,
          r.rejected
        ]);
        break;
      case 'qr-scans':
        headers = ['Room Name', 'Building', 'Floor', 'Token', 'Total Scans', 'Last Scanned At', 'Status'];
        rows = reportData.map(q => [
          q.roomName,
          q.buildingName,
          q.floorName,
          q.token,
          q.scansCount,
          q.lastScannedAt ? new Date(q.lastScannedAt).toLocaleString() : 'Never',
          q.status
        ]);
        break;
      case 'audit-logs':
        headers = ['Username', 'Action', 'Details', 'Timestamp'];
        rows = reportData.map(log => [
          log.username,
          log.action,
          log.details,
          new Date(log.createdAt).toLocaleString()
        ]);
        break;
      case 'inspections':
      default:
        headers = ['Receipt No', 'Inspector', 'Building', 'Floor', 'Room', 'Date', 'Cleaned', 'Rating', 'Status', 'Supervisor Remarks'];
        rows = reportData.map(i => [
          i.receiptNumber || i.id,
          i.inspectorName,
          i.buildingName,
          i.floorName,
          i.roomName,
          new Date(i.deviceTime || i.createdAt).toLocaleString(),
          i.cleaned ? 'Yes' : 'No',
          i.rating !== undefined ? `${i.rating} Stars` : 'N/A',
          i.status || 'Submitted',
          i.supervisorRemarks || ''
        ]);
        break;
    }

    return { headers, rows };
  };

  const downloadCSV = () => {
    const { headers, rows } = getReportHeadersAndRows();
    if (rows.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", getExportFilename("csv"));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    const { headers, rows } = getReportHeadersAndRows();
    if (rows.length === 0) return;

    const dataMatrix = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(dataMatrix);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facility Report");
    XLSX.writeFile(workbook, getExportFilename("xlsx"));
  };

  const downloadPDF = () => {
    const { headers, rows } = getReportHeadersAndRows();
    if (rows.length === 0) return;

    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    
    // Header styling
    doc.setFontSize(18);
    doc.setTextColor(46, 125, 50); // CleanCheck green
    doc.setFont("Helvetica", "bold");
    doc.text("CLEANCHECK COMPLIANCE REPORT", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("Helvetica", "normal");
    doc.text(`Report Type: ${reportType.toUpperCase()} | Export Date: ${new Date().toLocaleString()}`, 14, 21);
    doc.text(`Generated by: ${currentUser.fullName} (${currentUser.role})`, 14, 26);

    const headersMatrix = [headers];
    
    (doc as any).autoTable({
      head: headersMatrix,
      body: rows,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 249, 246] }
    });

    doc.save(getExportFilename("pdf"));
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="reports-tab-container">
      {/* Header Banner */}
      <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6" id="reports-header-banner">
        <div>
          <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-green-200">
            Reports Module
          </span>
          <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight mt-3">Facility Intelligence & Analytics</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Query deep compliance statistics, audit logs, cleaner performance indicators, and map QR-scans directly from your operational MongoDB Atlas datastore.
          </p>
        </div>

        {/* Action Downloads */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button 
            onClick={downloadCSV}
            disabled={reportData.length === 0}
            className="flex items-center justify-center gap-2 bg-[#FAFAF8] border border-[#E9E5DE] hover:bg-gray-100 disabled:opacity-50 text-[#1F2937] text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Export CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-gray-600" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button 
            onClick={downloadExcel}
            disabled={reportData.length === 0}
            className="flex items-center justify-center gap-2 bg-[#FAFAF8] border border-[#E9E5DE] hover:bg-gray-100 disabled:opacity-50 text-[#1F2937] text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#2E7D32]" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button 
            onClick={downloadPDF}
            disabled={reportData.length === 0}
            className="flex items-center justify-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Export PDF"
          >
            <FileText className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">PDF Report</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex overflow-x-auto gap-1 bg-[#FAFAF8] border border-[#E9E5DE] p-1.5 rounded-2xl scrollbar-none" id="reports-type-selector">
        {(
          [
            { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
            { id: 'daily', label: 'Daily', icon: Calendar },
            { id: 'weekly', label: 'Weekly', icon: Calendar },
            { id: 'monthly', label: 'Monthly', icon: Calendar },
            { id: 'performance', label: 'Inspectors', icon: User },
            { id: 'buildings', label: 'Buildings', icon: Building },
            { id: 'floors', label: 'Floors', icon: Layers },
            { id: 'rooms', label: 'Rooms', icon: MapPin },
            { id: 'qr-scans', label: 'QR Scans', icon: QrCode },
            { id: 'audit-logs', label: 'Audit Logs', icon: ShieldCheck }
          ] as { id: ReportType; label: string; icon: any }[]
        ).map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide whitespace-nowrap transition-all ${
                isSelected 
                  ? 'bg-[#2E7D32] text-white shadow-xs' 
                  : 'text-gray-500 hover:bg-[#E9E5DE]/30 hover:text-[#1F2937]'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Filters Form */}
      <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6" id="reports-filters-box">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center gap-2 text-[#1F2937]">
            <Filter className="w-4 h-4 text-[#2E7D32]" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Report Filter Criteria</h3>
          </div>
          <button 
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-gray-400 hover:text-red-600 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Filter Options
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Organization Selector (Super Admin Only) */}
          {currentUser.role === 'Super Admin' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Client Organization</label>
              <select 
                value={selectedOrg} 
                onChange={(e) => {
                  setSelectedOrg(e.target.value);
                  setSelectedBuilding('');
                  setSelectedFloor('');
                  setSelectedRoom('');
                }}
                className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              >
                <option value="">-- All Clients --</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Building Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Building Location</label>
            <select 
              value={selectedBuilding} 
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedFloor('');
                setSelectedRoom('');
              }}
              className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
            >
              <option value="">-- All Buildings --</option>
              {availableBuildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Floor Level</label>
            <select 
              value={selectedFloor} 
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setSelectedRoom('');
              }}
              className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              disabled={!selectedBuilding}
            >
              <option value="">{selectedBuilding ? '-- All Floors --' : 'Select a Building First'}</option>
              {availableFloors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Room Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Audit Room</label>
            <select 
              value={selectedRoom} 
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              disabled={!selectedFloor}
            >
              <option value="">{selectedFloor ? '-- All Rooms --' : 'Select a Floor First'}</option>
              {availableRooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Inspector Selector */}
          {reportType !== 'performance' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Field Inspector</label>
              <select 
                value={selectedInspector} 
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              >
                <option value="">-- All Inspectors --</option>
                {inspectors.map(ins => (
                  <option key={ins.id} value={ins.id}>{ins.fullName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Selector */}
          {(reportType === 'inspections' || reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly' || reportType === 'performance' || reportType === 'buildings' || reportType === 'floors' || reportType === 'rooms') && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Audit Status</label>
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              >
                <option value="">-- All Statuses --</option>
                <option value="Submitted">Submitted</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          )}

          {/* Rating Filter */}
          {(reportType === 'inspections') && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Quality Stars Rating</label>
              <select 
                value={selectedRating} 
                onChange={(e) => setSelectedRating(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              >
                <option value="">-- All Ratings --</option>
                <option value="5">5 Stars (Excellent)</option>
                <option value="4">4 Stars (Good)</option>
                <option value="3">3 Stars (Average)</option>
                <option value="2">2 Stars (Poor)</option>
                <option value="1">1 Star (Critical)</option>
              </select>
            </div>
          )}

          {/* QR Token Filter */}
          {reportType === 'qr-scans' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">QR Token Code</label>
              <input 
                type="text" 
                placeholder="Search token..." 
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
              />
            </div>
          )}

          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs font-bold p-2 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs font-bold p-2 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl outline-none"
            />
          </div>
        </div>
      </div>

      {/* Report Data Display Grid */}
      <div className="bg-white border border-[#E9E5DE] rounded-3xl overflow-hidden shadow-xs" id="reports-output-card">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-[#2E7D32]" />
            <p className="text-xs font-bold uppercase tracking-wider">Syncing Report Data from MongoDB Atlas...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">{errorMsg}</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 bg-[#FAFAF8] text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#E9E5DE]">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-[#1F2937] text-sm uppercase tracking-wider">No Compliance Records Found</h3>
            <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">There are no operational data points in your selected criteria or date ranges inside MongoDB.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#E9E5DE]">
                  {getReportHeadersAndRows().headers.map((hdr, idx) => (
                    <th key={idx} className="py-4 px-6 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{hdr}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {getReportHeadersAndRows().rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#FAFAF8]/50 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-4 px-6 text-xs text-[#1F2937] font-bold">
                        {String(cell).includes('Stars') ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[#F57C00]">{cell}</span>
                            <Star className="w-3 h-3 text-[#F57C00] fill-current" />
                          </div>
                        ) : String(cell) === 'Yes' || String(cell) === 'Active' || String(cell) === 'Verified' ? (
                          <span className="bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                            {cell}
                          </span>
                        ) : String(cell) === 'No' || String(cell) === 'Disabled' || String(cell) === 'Rejected' ? (
                          <span className="bg-red-50 text-red-600 text-[9px] font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                            {cell}
                          </span>
                        ) : String(cell) === 'Submitted' || String(cell) === 'Pending' ? (
                          <span className="bg-[#FFF3E0] text-[#E65100] text-[9px] font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                            {cell}
                          </span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Statistics count footer */}
        <div className="bg-[#FAFAF8] border-t border-[#E9E5DE] py-4 px-6 flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wide">
          <span>Operational records count: {reportData.length} entries loaded</span>
          <span>Source: Auth MongoDB Instance</span>
        </div>
      </div>
    </div>
  );
}
