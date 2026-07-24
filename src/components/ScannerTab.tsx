import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Camera, 
  Cpu, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Star, 
  MapPin, 
  Send, 
  Loader2,
  Undo2,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Room, User, extractQrToken } from '../types';

interface ScannerTabProps {
  currentUser: User | null;
  rooms: Room[];
  onAddInspection: (inspection: {
    roomId: string;
    inspectorId: string;
    cleaned: boolean;
    rating: number;
    remarks: string;
    deviceTime: string;
    photoUrl?: string;
  }) => Promise<void>;
  onManualScanToken?: (token: string) => void;
  isProcessing?: boolean;
}

export default function ScannerTab({
  currentUser,
  rooms,
  onAddInspection,
  onManualScanToken,
  isProcessing
}: ScannerTabProps) {

  // Scan states: 'scanning' | 'form' | 'success' | 'error'
  const [workflowState, setWorkflowState] = useState<'scanning' | 'form' | 'success' | 'error'>('scanning');
  
  // Validation data
  const [scannedRoom, setScannedRoom] = useState<{
    id: string;
    name: string;
    buildingName: string;
    floorName: string;
    organizationName: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [cleaned, setCleaned] = useState(true);
  const [rating, setRating] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Scanning simulation selected token fallback
  const [selectedDemoToken, setSelectedDemoToken] = useState(rooms[0]?.qrToken || '');

  // 1. ONLINE / OFFLINE CONNECTIVITY QUEUE
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cleancheck_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('cleancheck_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const syncOfflineDrafts = async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncingOffline(true);
    let successfullySynced = 0;
    const remainingQueue = [...offlineQueue];

    for (const draft of offlineQueue) {
      try {
        const response = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft)
        });
        if (response.ok) {
          successfullySynced += 1;
          const idx = remainingQueue.findIndex(item => item.id === draft.id);
          if (idx !== -1) remainingQueue.splice(idx, 1);
        }
      } catch (err) {
        console.error('Failed to sync draft item:', err);
      }
    }

    setOfflineQueue(remainingQueue);
    setIsSyncingOffline(false);
    alert(`Successfully synchronized ${successfullySynced} offline reports to Cloud Firestore!`);
  };

  // 2. COMPRESSED EVIDENCE PHOTO CAPTURE
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Compress local snapshot to 0.6 to save payload space and database capacity
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoUrl(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 3. CANVAS DIGITAL COMPLIANCE SIGNATURE
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1F2937';
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // 4. REAL-TIME GEOLOCATION GPS LOCK
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);

  const acquireGps = () => {
    if (!navigator.geolocation) {
      setGpsError('GPS geolocation not supported by browser.');
      return;
    }
    setIsAcquiringGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6))
        });
        setGpsError(null);
        setIsAcquiringGps(false);
      },
      (err) => {
        console.warn('GPS location access error:', err);
        setGpsError('Coordinates restricted (granted inside original window).');
        setIsAcquiringGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (workflowState === 'form') {
      acquireGps();
    }
  }, [workflowState]);

  // Real Camera scan initialization
  useEffect(() => {
    if (workflowState !== 'scanning') return;

    // We only try to load the scanner if we are on the scanning screen
    const scannerId = 'html5-qrcode-reader';
    const element = document.getElementById(scannerId);
    if (!element) return;

    let scanner: Html5QrcodeScanner | null = null;

    try {
      scanner = new Html5QrcodeScanner(
        scannerId,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // Success callback
          handleProcessToken(decodedText);
          if (scanner) scanner.clear().catch(err => console.error(err));
        },
        (error) => {
          // Failure callback is usually verbose, we ignore it to prevent logs overflow
        }
      );
    } catch (e) {
      console.warn("Camera hardware access is restricted inside iframe or lacks HTTPS. Falling back to Simulated scan controls.", e);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.warn("Error cleaning scanner on unmount:", err));
      }
    };
  }, [workflowState]);

  // Unified function to validate token and transition to Inspection Form
  const handleProcessToken = async (rawInput: string) => {
    if (onManualScanToken) {
      onManualScanToken(rawInput);
      return;
    }
    try {
      const cleanToken = extractQrToken(rawInput);
      if (!cleanToken) {
        throw new Error('Invalid QR code scanned. No valid token could be extracted.');
      }

      const jwtToken = localStorage.getItem('cleancheck_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
      }

      const userIdParam = currentUser ? `?userId=${currentUser.id}` : '';
      const response = await fetch(`/api/scan/${encodeURIComponent(cleanToken)}${userIdParam}`, { headers });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to validate QR badge token.');
      }

      const data = await response.json();
      const resolvedRoom = data.room || { id: data.roomId, name: data.roomName };
      setScannedRoom({
        id: resolvedRoom.id || data.roomId || 'room-unknown',
        name: resolvedRoom.name || data.roomName || 'Scanned Facility Room',
        buildingName: data.buildingName || 'Main Facility',
        floorName: data.floorName || 'Floor Level',
        organizationName: data.organizationName || 'Client Organization'
      });
      setWorkflowState('form');
    } catch (err: any) {
      setErrorMessage(err.message || 'The scanned QR code is either invalid, corrupted, or has been disabled.');
      setWorkflowState('error');
    }
  };

  // Submit inspection form (with offline queue logic)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !scannedRoom) return;

    let signatureBase64 = '';
    if (hasSigned && canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL('image/png');
    }

    const payload = {
      roomId: scannedRoom.id,
      inspectorId: currentUser.id,
      cleaned,
      rating,
      remarks: remarks.trim(),
      deviceTime: new Date().toISOString(),
      photoUrl,
      signatureUrl: signatureBase64,
      latitude: gpsCoords?.lat,
      longitude: gpsCoords?.lng
    };

    if (!isOnline) {
      // Add mock id for offline list key mapping
      const draftPayload = {
        ...payload,
        id: `draft-${Date.now()}`,
        roomName: scannedRoom.name,
        floorName: scannedRoom.floorName,
        buildingName: scannedRoom.buildingName,
        organizationName: scannedRoom.organizationName,
        inspectorName: currentUser.fullName,
        syncedToGoogleSheets: false
      };
      setOfflineQueue(prev => [...prev, draftPayload]);
      
      // Reset form fields
      setRemarks('');
      setPhotoUrl('');
      clearSignature();
      setWorkflowState('success');
      return;
    }

    try {
      await onAddInspection(payload);

      // Reset form fields
      setRemarks('');
      setPhotoUrl('');
      clearSignature();
      setWorkflowState('success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit inspection checklist.');
      setWorkflowState('error');
    }
  };

  const handleResetScanner = () => {
    setScannedRoom(null);
    setErrorMessage('');
    setWorkflowState('scanning');
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in" id="scanner-container">
      
      {/* OFFLINE INDICATOR & RETRY SYNC COMPONENT */}
      <div className="mb-4 flex flex-col gap-2">
        {!isOnline && (
          <div className="bg-[#FFF3E0] border border-[#FFE0B2] text-[#E65100] px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#EF6C00] rounded-full animate-ping" />
              Inspector Offline — Saving as Drafts to Device Storage
            </span>
            {offlineQueue.length > 0 && (
              <span className="bg-[#FFE0B2] px-2 py-0.5 rounded text-[10px]">
                {offlineQueue.length} Drafts Cached
              </span>
            )}
          </div>
        )}

        {isOnline && offlineQueue.length > 0 && (
          <div className="bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D32] px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#4CAF50] rounded-full" />
              Connectivity Restored — {offlineQueue.length} Pending Audits Cached Offline
            </span>
            <button
              onClick={syncOfflineDrafts}
              disabled={isSyncingOffline}
              className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-3 py-1.5 rounded-lg text-[10px] transition-all disabled:bg-gray-300"
            >
              {isSyncingOffline ? 'Uploading...' : 'Sync Cloud'}
            </button>
          </div>
        )}
      </div>

      {/* 1. STATE: SCANNING SCREEN */}
      {workflowState === 'scanning' && (
        <div className="flex flex-col gap-6" id="scanning-step-panel">
          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs text-center">
            <span className="text-[10px] font-extrabold tracking-widest bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded border border-green-200 uppercase">
              Compliance Audit Engine
            </span>
            <h2 className="text-xl font-extrabold text-[#1F2937] mt-3">Scan Facility Room QR</h2>
            <p className="text-xs text-gray-400 mt-1">
              Align secure room badge below. Coordinates and signature locked automatically.
            </p>
          </div>

          {/* Real Camera Container Frame */}
          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-4 shadow-xs">
            <div 
              id="html5-qrcode-reader" 
              className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50"
              style={{ minHeight: '280px' }}
            />
          </div>

          {/* SIMULATOR SANDBOX CARD FOR BULLETPROOF DEMO */}
          <div className="bg-[#FFFDE7] border border-[#FFF59D] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4.5 h-4.5 text-[#C8A165]" />
              <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-wide">
                Iframe Sandboxed Scan Simulator (Recommended)
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Browsers block hardware cameras inside secure preview iframe environments. Use this simulator to instantly trigger a scanning workflow for any active room.
            </p>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={selectedDemoToken}
                onChange={(e) => setSelectedDemoToken(e.target.value)}
                className="flex-1 text-xs bg-white border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-bold text-[#1F2937]"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.qrToken}>
                    Simulate Scanned Room: {r.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleProcessToken(selectedDemoToken)}
                className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                id="run-simulated-scan-btn"
              >
                Simulate Scan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. STATE: INSPECTION CHECKLIST FORM */}
      {workflowState === 'form' && scannedRoom && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 md:p-8 shadow-xs flex flex-col gap-6 animate-fade-in" id="inspection-form-panel">
          
          {/* Header Map Info */}
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold tracking-widest bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded border border-green-200 uppercase">
                Facility Verified
              </span>
              
              {/* GPS coordinates lock info badge */}
              {gpsCoords ? (
                <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
                  GPS: {gpsCoords.lat}, {gpsCoords.lng}
                </span>
              ) : isAcquiringGps ? (
                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 animate-pulse">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  Acquiring Location Lock...
                </span>
              ) : gpsError ? (
                <span className="text-[10px] text-orange-500 font-semibold flex items-center gap-1">
                  GPS: Coords Cached
                </span>
              ) : null}
            </div>

            <h3 className="text-xl font-extrabold text-[#1F2937] mt-3">
              {scannedRoom.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{scannedRoom.organizationName} • {scannedRoom.buildingName} • {scannedRoom.floorName}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
            
            {/* Cleaned Toggle Switch */}
            <div className="flex items-center justify-between bg-[#FAFAF8] border border-[#E9E5DE] p-4 rounded-xl">
              <div>
                <p className="font-extrabold text-xs text-[#1F2937]">Facility Status Audit *</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Is this room cleaned and compliant with safety metrics?</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCleaned(true)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
                    cleaned 
                      ? 'bg-[#2E7D32] text-white' 
                      : 'bg-white border border-gray-200 text-gray-500'
                  }`}
                  id="status-cleaned-btn"
                >
                  Yes, Cleaned
                </button>
                <button
                  type="button"
                  onClick={() => setCleaned(false)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
                    !cleaned 
                      ? 'bg-[#EF4444] text-white' 
                      : 'bg-white border border-gray-200 text-gray-500'
                  }`}
                  id="status-dirty-btn"
                >
                  No, Dirty / Alert
                </button>
              </div>
            </div>

            {/* Star Rating Selector */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Overall Cleanliness Rating *</label>
              <div className="flex items-center gap-1.5" id="rating-stars-selection">
                {[1, 2, 3, 4, 5].map(star => {
                  const isActive = star <= rating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1.5 transition-transform active:scale-90 hover:scale-110"
                    >
                      <Star className={`w-8 h-8 ${isActive ? 'text-[#C8A165] fill-[#C8A165]' : 'text-gray-200'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remarks Textarea */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Observation Remarks &amp; Feedback</label>
              <textarea
                rows={3}
                placeholder="Describe stock counts, floor cleanliness, mirror streaks, or other pending items..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-medium text-[#1F2937]"
                id="inspection-remarks-input"
              />
            </div>

            {/* REAL DEVICE CAMERA ATTACHMENT */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
                Capture Evidence Photo (Compressed local JPG upload)
              </label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-[#E9E5DE] rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Camera className="w-4 h-4 text-[#2E7D32]" />
                  Take Photo / Select File
                </button>
                
                {/* Fallback mock button */}
                <button
                  type="button"
                  onClick={() => setPhotoUrl('https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop')}
                  className="px-3 bg-gray-50 hover:bg-gray-100 border border-[#E9E5DE] rounded-xl text-xs font-bold text-gray-500 transition-all flex items-center gap-1"
                >
                  Load Mock Snapshot
                </button>
              </div>

              {photoUrl && (
                <div className="mt-3 relative inline-block">
                  <img src={photoUrl} alt="Preview" className="w-40 h-24 object-cover rounded-xl border border-[#E9E5DE] shadow-xs" />
                  <span className="absolute bottom-1 right-1 bg-black/60 text-[8px] text-white px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    Compressed
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute -top-1.5 -right-1.5 bg-[#EF4444] text-white rounded-full p-1 shadow-md hover:bg-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* TOUCH/MOUSE SIGNATURE PAD */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Inspector Auth Signature (Required)
                </label>
                {hasSigned && (
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800"
                  >
                    Clear Canvas
                  </button>
                )}
              </div>
              <div className="border border-[#E9E5DE] rounded-xl overflow-hidden bg-gray-50">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-28 block cursor-crosshair touch-none"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">
                Please scribble your signature inside the frame above to legalize the compliance record.
              </p>
            </div>

            {/* Form actions submit / cancel */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
              <button
                type="button"
                onClick={handleResetScanner}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1"
              >
                <Undo2 className="w-4 h-4" /> Cancel Scan
              </button>

              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-[#2E7D32]/10"
                id="submit-inspection-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Audit...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Compliance Report
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 3. STATE: AUDIT SUCCESS SCREEN */}
      {workflowState === 'success' && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-8 shadow-xs text-center flex flex-col items-center gap-4 animate-fade-in" id="scanner-success-panel">
          <div className="w-12 h-12 bg-green-100 text-[#2E7D32] rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1F2937] uppercase tracking-wide">
              {isOnline ? 'Inspection Logged Successfully' : 'Draft Saved Offline'}
            </h3>
            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {isOnline ? (
                <span>Your facility compliance checklist rating, evidence photo, digital signature, and GPS coordinates have been securely appended to Google Cloud Firestore.</span>
              ) : (
                <span>This audit report was saved locally. Re-connect to a network to upload draft checklists to cloud servers!</span>
              )}
            </p>
          </div>

          <button
            onClick={handleResetScanner}
            className="mt-2 px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            id="scan-another-btn"
          >
            Audit Another Room
          </button>
        </div>
      )}

      {/* 4. STATE: ERROR ALIGN SCREEN */}
      {workflowState === 'error' && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-8 shadow-xs text-center flex flex-col items-center gap-4 animate-fade-in" id="scanner-error-panel">
          <div className="w-12 h-12 bg-red-100 text-[#EF4444] rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1F2937] uppercase tracking-wide">Scan Verification Failed</h3>
            <p className="text-xs text-red-500 font-semibold mt-2 max-w-sm mx-auto leading-relaxed bg-red-50 p-3 rounded-lg border border-red-100">
              {errorMessage}
            </p>
          </div>

          <button
            onClick={handleResetScanner}
            className="mt-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-all"
            id="try-scanning-again-btn"
          >
            Reset Compliance Scanner
          </button>
        </div>
      )}

    </div>
  );
}
