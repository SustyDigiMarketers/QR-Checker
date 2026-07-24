import React, { useState } from 'react';
import { 
  QrCode, 
  Download, 
  Printer, 
  RefreshCw, 
  Eye, 
  Search, 
  ShieldAlert, 
  Check, 
  ToggleLeft, 
  ToggleRight,
  ChevronRight,
  Layers,
  Building2,
  FolderTree
} from 'lucide-react';
import { QrCodeDetails, Room, Building, Floor } from '../types';

interface QrCodeTabProps {
  qrCodes: QrCodeDetails[];
  rooms: Room[];
  buildings: Building[];
  floors: Floor[];
  onRegenerateQr: (roomId: string) => Promise<void>;
  onToggleQr: (roomId: string) => Promise<void>;
  isProcessing: boolean;
}

export default function QrCodeTab({
  qrCodes,
  rooms,
  buildings,
  floors,
  onRegenerateQr,
  onToggleQr,
  isProcessing
}: QrCodeTabProps) {

  // Search filter and selected room code display state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);

  // Safe array guards
  const safeQrCodes = Array.isArray(qrCodes) ? qrCodes : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const safeFloors = Array.isArray(floors) ? floors : [];

  // Filter QR codes
  const filteredQrs = safeQrCodes.filter(q => {
    const room = safeRooms.find(r => r.id === q.roomId);
    if (!room) return false;
    return (
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.token.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const activeQr = safeQrCodes.find(q => q.roomId === selectedQrId);
  const activeRoom = activeQr ? safeRooms.find(r => r.id === activeQr.roomId) : null;
  const activeBuilding = activeRoom ? safeBuildings.find(b => b.id === activeRoom.buildingId) : null;
  const activeFloor = activeRoom ? safeFloors.find(f => f.id === activeRoom.floorId) : null;

  // Helper to construct full scanning URL for QR code encoding
  const getQrFullUrl = (token: string) => {
    if (!token) return '';
    const origin = window.location.origin || 'https://qr-checker-zhj9.onrender.com';
    return `${origin}/scan/${encodeURIComponent(token)}`;
  };

  // Print function (opens standard browser print dialog)
  const handlePrintBadge = () => {
    const printableArea = document.getElementById('printable-qr-badge');
    if (!printableArea) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fullScanUrl = getQrFullUrl(activeQr?.token || '');

    printWindow.document.write(`
      <html>
        <head>
          <title>CleanCheck - Facility Compliance Badge</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .badge-card { border: 2px solid #2E7D32; border-radius: 16px; padding: 30px; text-align: center; max-width: 320px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .badge-title { font-size: 24px; font-weight: 800; color: #1F2937; margin: 0 0 5px 0; letter-spacing: -0.5px; }
            .badge-subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 20px; }
            .qr-image { width: 180px; height: 180px; margin-bottom: 15px; }
            .room-name { font-size: 18px; font-weight: 700; color: #2E7D32; margin: 10px 0; }
            .location-text { font-size: 12px; color: #4B5563; margin: 5px 0 15px 0; font-weight: 500; }
            .scan-inst { font-size: 10px; font-weight: bold; background: #E8F5E9; color: #2E7D32; padding: 6px 12px; border-radius: 9999px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="badge-card">
            <div class="badge-title">CLEANCHECK</div>
            <div class="badge-subtitle">FACILITY COMPLIANCE BADGE</div>
            <img class="qr-image" src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullScanUrl)}" />
            <div class="room-name">${activeRoom?.name}</div>
            <div class="location-text">${activeBuilding?.name} • ${activeFloor?.name}</div>
            <div class="scan-inst">SCAN QR TO LOG INSPECTION</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="qr-tab-panel">
      
      {/* Left List of QR tokens */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-2xs">
          <h2 className="text-sm font-extrabold text-[#1F2937] uppercase tracking-wide flex items-center gap-2 mb-1">
            <QrCode className="w-4.5 h-4.5 text-[#2E7D32]" />
            QR Compliance Assignment Hub
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Each room generates a secure token-key. Scan the badge on-site using standard cameras or the built-in app scanner to immediately log facility inspection checklist audits.
          </p>

          <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl px-3.5 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter QR keys by room name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-[#1F2937] placeholder-gray-400 font-semibold"
            />
          </div>
        </div>

        {/* List mapping */}
        <div className="bg-white border border-[#E9E5DE] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-y-auto max-h-[460px] divide-y divide-gray-100">
            {filteredQrs.length === 0 ? (
              <div className="py-12 text-center text-gray-400 font-bold text-xs uppercase tracking-wider">
                No active QR credentials found.
              </div>
            ) : (
              filteredQrs.map(qr => {
                const room = rooms.find(r => r.id === qr.roomId);
                const isSelected = selectedQrId === qr.roomId;
                return (
                  <div
                    key={qr.roomId}
                    onClick={() => setSelectedQrId(qr.roomId)}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-all ${
                      isSelected ? 'bg-[#FAFAF8] border-l-4 border-[#2E7D32]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <QrCode className={`w-5 h-5 ${qr.status === 'Active' ? 'text-[#2E7D32]' : 'text-gray-300'}`} />
                      </div>
                      <div>
                        <p className="font-extrabold text-xs text-[#1F2937]">{room ? room.name : 'Unknown Facility'}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[200px]" title={qr.token}>
                          Token: {qr.token}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                        qr.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {qr.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Visual QR Code Card badge rendering and management actions */}
      <div className="lg:col-span-5">
        {selectedQrId && activeQr && activeRoom ? (
          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-6 sticky top-4 animate-fade-in" id="qr-badge-preview">
            
            {/* Compliance Header */}
            <div className="text-center pb-4 border-b border-gray-100">
              <span className="text-[9px] font-extrabold tracking-widest bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded border border-green-200 uppercase">
                CleanCheck QR Badge
              </span>
              <h3 className="text-base font-extrabold text-[#1F2937] mt-3 uppercase tracking-tight">
                {activeRoom.name}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                {activeBuilding?.name} • {activeFloor?.name}
              </p>
            </div>

            {/* Rendered Badge SVG inside card */}
            <div className="flex flex-col items-center justify-center py-4 bg-[#FAFAF8] border border-[#E9E5DE] rounded-2xl relative">
              
              {/* Disabled Mask Overlay if status is disabled */}
              {activeQr.status === 'Disabled' && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center p-6 text-center z-10">
                  <ShieldAlert className="w-8 h-8 text-[#EF4444] mb-2 animate-bounce" />
                  <p className="font-extrabold text-xs text-[#1F2937] uppercase">Token Disabled</p>
                  <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">
                    This QR badge has been flagged as inactive and will fail on-site inspections.
                  </p>
                </div>
              )}

              {/* Secure QR Server Image */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-xs mb-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getQrFullUrl(activeQr.token))}`}
                  alt="Room QR Code"
                  className="w-40 h-40 object-contain"
                />
              </div>

              {/* Token Display */}
              <span className="font-mono text-[10px] text-gray-400 font-semibold bg-white border border-gray-200/60 px-3 py-1 rounded-md">
                TOKEN: {activeQr.token}
              </span>
            </div>

            {/* Action Buttons list */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePrintBadge}
                disabled={activeQr.status === 'Disabled'}
                className="w-full py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all"
                id="print-qr-badge-btn"
              >
                <Printer className="w-4 h-4" />
                <span>Print Compliance Badge</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                
                {/* Toggle Active status */}
                <button
                  onClick={() => onToggleQr(activeQr.roomId)}
                  disabled={isProcessing}
                  className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#1F2937] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  id="toggle-qr-status-btn"
                >
                  {activeQr.status === 'Active' ? (
                    <>
                      <ToggleRight className="w-4.5 h-4.5 text-[#2E7D32]" />
                      <span>Disable Badge</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4.5 h-4.5 text-gray-400" />
                      <span>Activate Badge</span>
                    </>
                  )}
                </button>

                {/* Regenerate Token code */}
                <button
                  onClick={() => onRegenerateQr(activeQr.roomId)}
                  disabled={isProcessing}
                  className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#1F2937] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  id="regenerate-qr-btn"
                >
                  <RefreshCw className={`w-4 h-4 text-[#C8A165] ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Refresh Key</span>
                </button>

              </div>
            </div>

            {/* Quick Metrics */}
            <div className="bg-[#FAFAF8] border border-gray-100 rounded-xl p-3.5 flex justify-between text-xs text-gray-500 font-semibold">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Scan Frequency</p>
                <p className="text-sm font-extrabold text-[#1F2937] mt-1">{activeQr.scansCount} audits</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last Scanned</p>
                <p className="text-sm font-extrabold text-[#1F2937] mt-1">
                  {activeQr.lastScannedAt ? new Date(activeQr.lastScannedAt).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-white border border-dashed border-[#E9E5DE] rounded-2xl p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <QrCode className="w-10 h-10 text-gray-300 stroke-[1.5]" />
            <p className="font-extrabold text-xs uppercase tracking-wide">No Badge Selected</p>
            <p className="text-[10px] leading-relaxed max-w-[200px]">
              Select a facility room from the left grid list to load its real-time compliance QR card.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
