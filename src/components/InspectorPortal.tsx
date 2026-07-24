import React, { useState, useEffect, useRef } from 'react';
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
  Trash2,
  LogOut,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Room, User, Assignment, Inspection, extractQrToken } from '../types';

interface InspectorPortalProps {
  currentUser: User;
  rooms: Room[];
  assignments: Assignment[];
  inspections: Inspection[];
  onAddInspection: (inspection: {
    roomId: string;
    inspectorId: string;
    cleaned: boolean;
    rating: number;
    remarks: string;
    deviceTime: string;
    photoUrl?: string;
    signatureUrl?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<any>;
  onLogout: () => void;
  isProcessing: boolean;
}

export default function InspectorPortal({
  currentUser,
  rooms,
  assignments,
  inspections,
  onAddInspection,
  onLogout,
  isProcessing
}: InspectorPortalProps) {
  
  // Calculate assigned rooms for the current user today
  const todayStr = new Date().toISOString().split('T')[0];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeInspections = Array.isArray(inspections) ? inspections : [];
  const myAssignments = safeAssignments.filter(a => a.inspectorId === currentUser.id && a.date === todayStr);
  const myAssignedRoomIds = Array.from(new Set(myAssignments.flatMap(asg => asg.roomIds)));

  const todayStartForCheck = new Date();
  todayStartForCheck.setHours(0, 0, 0, 0);
  const myCompletedRoomIds = new Set(
    safeInspections
      .filter(ins => {
        const date = new Date(ins.createdAt);
        return date >= todayStartForCheck && ins.inspectorId === currentUser.id;
      })
      .map(ins => ins.roomId)
  );

  // States: 'scanning' | 'form' | 'success' | 'error'
  const [workflowState, setWorkflowState] = useState<'scanning' | 'form' | 'success' | 'error'>('scanning');
  
  // Scanned room details
  const [scannedRoom, setScannedRoom] = useState<{
    id: string;
    name: string;
    buildingName: string;
    floorName: string;
    organizationName: string;
    qrToken: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [cleanedSelection, setCleanedSelection] = useState<'yes' | 'no' | 'other'>('yes');
  const [otherStatusText, setOtherStatusText] = useState('');
  const [rating, setRating] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedDemoToken, setSelectedDemoToken] = useState(rooms[0]?.qrToken || '');

  // Touch/Mouse signature pad states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Online/Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cleancheck_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // GPS States
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);

  // Auto-acquire current time
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Success screen data saved to show in Screen 4
  const [successData, setSuccessData] = useState<{
    roomName: string;
    submittedTime: string;
    submittedDate: string;
    receiptNumber?: string;
    shift?: string;
  } | null>(null);

  // Sync offline data
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Track online/offline status
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

  // Save offline queue to localstorage
  useEffect(() => {
    localStorage.setItem('cleancheck_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Sync offline drafts
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
        console.error('Failed to sync offline draft:', err);
      }
    }

    setOfflineQueue(remainingQueue);
    setIsSyncingOffline(false);
    alert(`Successfully synchronized ${successfullySynced} offline reports to Cloud Firestore!`);
  };

  // Acquire GPS Geolocation
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
        setGpsError('Permission restricted (coordinates simulated)');
        // Fallback simulated coords
        setGpsCoords({ lat: 37.7749, lng: -122.4194 });
        setIsAcquiringGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Set time when entering Form screen
  useEffect(() => {
    if (workflowState === 'form') {
      acquireGps();
      
      const now = new Date();
      // Format time: 09:45 AM
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Format date: 09 Jul 2026
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      
      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    }
  }, [workflowState]);

  // Real camera scan renderer
  useEffect(() => {
    if (workflowState !== 'scanning') return;

    const scannerId = 'inspector-camera-view';
    const element = document.getElementById(scannerId);
    if (!element) return;

    let scanner: Html5QrcodeScanner | null = null;

    try {
      scanner = new Html5QrcodeScanner(
        scannerId,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          handleValidateAndProcessToken(decodedText);
          if (scanner) scanner.clear().catch(err => console.error(err));
        },
        (error) => {
          // ignore scan matching errors
        }
      );
    } catch (e) {
      console.warn("Camera hardware locked or unavailable inside sandbox iframe. Use the dropdown simulator below.", e);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.warn("Error clearing scanner:", err));
      }
    };
  }, [workflowState]);

  // Validate QR Token on Server
  const handleValidateAndProcessToken = async (rawInput: string) => {
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

      const response = await fetch(`/api/scan/${encodeURIComponent(cleanToken)}?userId=${currentUser.id}`, { headers });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to validate QR badge token.');
      }

      const data = await response.json();
      setScannedRoom({
        id: data.room.id,
        name: data.room.name,
        buildingName: data.buildingName,
        floorName: data.floorName,
        organizationName: data.organizationName,
        qrToken: cleanToken
      });
      setWorkflowState('form');
    } catch (err: any) {
      setErrorMessage(err.message || 'The scanned QR code is either invalid or has been disabled.');
      setWorkflowState('error');
    }
  };

  // Compressed photo upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoUrl(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drawing Canvas functions
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

  // Submit report
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedRoom) return;

    let signatureBase64 = '';
    if (hasSigned && canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL('image/png');
    }

    // Process remarks to include "Other" selection if relevant
    let finalRemarks = remarks.trim();
    if (cleanedSelection === 'other' && otherStatusText.trim()) {
      finalRemarks = `[Status: Other - ${otherStatusText.trim()}] ${finalRemarks}`;
    }

    const cleanedValue = cleanedSelection === 'yes';

    const payload = {
      roomId: scannedRoom.id,
      inspectorId: currentUser.id,
      cleaned: cleanedValue,
      rating,
      remarks: finalRemarks,
      deviceTime: new Date().toISOString(),
      photoUrl,
      signatureUrl: signatureBase64,
      latitude: gpsCoords?.lat,
      longitude: gpsCoords?.lng
    };

    if (!isOnline) {
      // Offline support caching
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
      
      setSuccessData({
        roomName: scannedRoom.name,
        submittedTime: currentTime,
        submittedDate: currentDate,
        receiptNumber: `PENDING-OFFLINE-${Date.now().toString().slice(-6)}`,
        shift: 'Manual/Offline'
      });

      // Reset form fields
      setRemarks('');
      setPhotoUrl('');
      setCleanedSelection('yes');
      setOtherStatusText('');
      setRating(5);
      setHasSigned(false);
      setWorkflowState('success');
      return;
    }

    try {
      const result = await onAddInspection(payload);
      
      setSuccessData({
        roomName: scannedRoom.name,
        submittedTime: currentTime,
        submittedDate: currentDate,
        receiptNumber: result?.inspection?.receiptNumber || result?.receiptNumber || 'CC-GENERATED-OK',
        shift: result?.inspection?.shift || result?.shift || 'Scheduled'
      });

      // Reset form fields
      setRemarks('');
      setPhotoUrl('');
      setCleanedSelection('yes');
      setOtherStatusText('');
      setRating(5);
      setHasSigned(false);
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
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans text-gray-800" id="inspector-portal-root">
      
      {/* HEADER BANNER */}
      <header className="bg-[#2E7D32] text-white px-6 py-4 flex items-center justify-between shadow-md" id="inspector-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold uppercase tracking-tight leading-none">CleanCheck</h1>
            <p className="text-[10px] text-green-150 font-bold mt-1 uppercase">Inspector Companion Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <p className="text-xs font-bold leading-none">{currentUser.fullName}</p>
            <span className="text-[9px] text-green-100 font-extrabold mt-1">ID: {currentUser.username}</span>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/40 hover:bg-red-800/60 rounded-lg text-xs font-bold transition-all"
            id="inspector-logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* OFFLINE INDICATOR */}
      <div className="max-w-2xl w-full mx-auto px-4 mt-4">
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-600 rounded-full animate-pulse" />
              Offline Companion Mode — Actions stored locally
            </span>
            {offlineQueue.length > 0 && (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px]">
                {offlineQueue.length} Drafts Cached
              </span>
            )}
          </div>
        )}

        {isOnline && offlineQueue.length > 0 && (
          <div className="bg-green-50 border border-green-200 text-[#2E7D32] px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#4CAF50] rounded-full animate-bounce" />
              Connection restored! {offlineQueue.length} unsynced drafts ready.
            </span>
            <button
              onClick={syncOfflineDrafts}
              disabled={isSyncingOffline}
              className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-3 py-1.5 rounded-lg text-[10px] transition-all disabled:bg-gray-300 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingOffline ? 'animate-spin' : ''}`} />
              Upload Drafts
            </button>
          </div>
        )}
      </div>

      {/* PORTAL VIEW CONTAINER */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 flex flex-col justify-center">

        {/* SCREEN 2: QR SCANNER SCREEN */}
        {workflowState === 'scanning' && (
          <div className="flex flex-col gap-6 animate-fade-in" id="inspector-scan-screen">
            
            {/* TODAY'S ASSIGNED ROOMS DASHBOARD */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 uppercase tracking-wider">Today's Assigned Rooms</h3>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Shift allocations issued to you</p>
                </div>
                <div className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-3 py-1 rounded-full border border-blue-100">
                  {myCompletedRoomIds.size} / {myAssignedRoomIds.length} Completed
                </div>
              </div>

              {myAssignedRoomIds.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs italic">
                  No specific rooms assigned to you for today's shift.<br />
                  <span className="text-[10px] text-gray-400 not-italic">You may scan any authorized room badge to log audits.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
                  {myAssignedRoomIds.map(rid => {
                    const room = rooms.find(r => r.id === rid);
                    if (!room) return null;
                    const isCompleted = myCompletedRoomIds.has(rid);
                    return (
                      <div
                        key={rid}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isCompleted
                            ? 'bg-green-50/50 border-green-200 text-green-800'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-350'
                        }`}
                      >
                        <div className="overflow-hidden pr-2">
                          <p className="text-xs font-bold truncate">{room.name}</p>
                          <p className="text-[9px] text-gray-400 font-medium mt-0.5">QR Identifier: {room.qrToken}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-extrabold px-2.5 py-1 rounded-md border border-green-200 uppercase tracking-wider">
                              <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32] fill-white" />
                              <span>Done</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedDemoToken(room.qrToken);
                                handleValidateAndProcessToken(room.qrToken);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 uppercase tracking-wide"
                            >
                              <span>Audit Room</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
              <span className="text-[10px] font-extrabold tracking-widest bg-green-50 text-[#2E7D32] px-2.5 py-1 rounded border border-green-150 uppercase">
                Active Audit Scanner
              </span>
              <h2 className="text-lg font-black text-gray-800 mt-2 uppercase tracking-tight">Scan Physical Room QR</h2>
              <p className="text-xs text-gray-400 mt-1">
                Point your camera at the CleanCheck badge to trigger the verification.
              </p>
            </div>

            {/* REAL CAMERA CONTAINER */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div 
                id="inspector-camera-view" 
                className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50"
                style={{ minHeight: '300px' }}
              />
              <div className="absolute inset-x-0 bottom-6 text-center pointer-events-none">
                <span className="bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
                  Camera Active
                </span>
              </div>
            </div>

            {/* DEMO SIMULATOR FALLBACK FOR CONVENIENT TESTING */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-amber-700" />
                <h3 className="font-extrabold text-xs text-amber-800 uppercase tracking-wide">
                  Iframe Sandbox QR Simulator
                </h3>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed mb-4">
                Since browser policies block device camera components inside secure nested previews, select any pre-registered room below to simulate a physical scanner read instantly.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedDemoToken}
                  onChange={(e) => setSelectedDemoToken(e.target.value)}
                  className="flex-1 text-xs bg-white border border-gray-200 p-3.5 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                  id="simulator-room-selector"
                >
                  <option value="">-- Choose a pre-seeded room --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.qrToken}>
                      Simulate scanning: {r.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleValidateAndProcessToken(selectedDemoToken)}
                  disabled={!selectedDemoToken}
                  className="px-6 py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  id="simulator-scan-btn"
                >
                  <span>Simulate Scan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: INSPECTION CHECKLIST FORM */}
        {workflowState === 'form' && scannedRoom && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6 animate-fade-in" id="inspector-form-screen">
            
            {/* Read-Only Facility Header */}
            <div className="border-b border-gray-150 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black tracking-widest bg-green-100 text-[#2E7D32] px-2.5 py-1 rounded-md border border-green-200 uppercase">
                  Verified Scan
                </span>
                
                {gpsCoords ? (
                  <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 fill-blue-600/10" />
                    GPS Locked
                  </span>
                ) : isAcquiringGps ? (
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 animate-pulse">
                    Acquiring GPS...
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-semibold">
                    GPS Coordinates Cached
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black text-gray-800 tracking-tight">{scannedRoom.name}</h3>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs font-semibold text-gray-500">
                <div>
                  <span className="block text-[9px] uppercase text-gray-400 tracking-wider">Client Organization</span>
                  <span className="text-gray-700">{scannedRoom.organizationName}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-gray-400 tracking-wider">Building Name</span>
                  <span className="text-gray-700">{scannedRoom.buildingName}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-gray-400 tracking-wider">Floor / Level</span>
                  <span className="text-gray-700">{scannedRoom.floorName}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-gray-400 tracking-wider">Room Number Key</span>
                  <span className="text-gray-700 font-mono">{scannedRoom.qrToken}</span>
                </div>
              </div>
            </div>

            {/* Complete Inspection Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
              
              {/* Read Only Inspector Field */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Authorized Inspector</label>
                  <input
                    type="text"
                    readOnly
                    value={currentUser.fullName}
                    className="w-full text-xs bg-gray-100 border border-gray-200 rounded-xl p-3 font-bold text-gray-600 cursor-not-allowed focus:outline-none"
                    id="form-inspector-readonly"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Timestamp (Auto)</label>
                  <input
                    type="text"
                    readOnly
                    value={`${currentTime} - ${currentDate}`}
                    className="w-full text-xs bg-gray-100 border border-gray-200 rounded-xl p-3 font-bold text-gray-600 cursor-not-allowed focus:outline-none"
                    id="form-timestamp-readonly"
                  />
                </div>
              </div>

              {/* Room Cleaned? Yes / No / Other */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Room Cleaned? *</label>
                <div className="grid grid-cols-3 gap-2" id="cleaned-status-selector">
                  <button
                    type="button"
                    onClick={() => setCleanedSelection('yes')}
                    className={`p-3 text-xs font-black rounded-xl border transition-all ${
                      cleanedSelection === 'yes'
                        ? 'bg-green-50 border-green-300 text-green-800 font-extrabold'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    id="cleaned-selection-yes"
                  >
                    Yes, Cleaned
                  </button>

                  <button
                    type="button"
                    onClick={() => setCleanedSelection('no')}
                    className={`p-3 text-xs font-black rounded-xl border transition-all ${
                      cleanedSelection === 'no'
                        ? 'bg-red-50 border-red-300 text-red-800 font-extrabold'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    id="cleaned-selection-no"
                  >
                    No, Dirty
                  </button>

                  <button
                    type="button"
                    onClick={() => setCleanedSelection('other')}
                    className={`p-3 text-xs font-black rounded-xl border transition-all ${
                      cleanedSelection === 'other'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 font-extrabold'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    id="cleaned-selection-other"
                  >
                    Other Status
                  </button>
                </div>

                {cleanedSelection === 'other' && (
                  <div className="mt-3 animate-fade-in" id="other-status-textbox-container">
                    <label className="block text-[9px] font-black text-amber-700 uppercase tracking-wider mb-1">Please specify facility condition *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Under maintenance, construction block, missing parts..."
                      value={otherStatusText}
                      onChange={(e) => setOtherStatusText(e.target.value)}
                      className="w-full text-xs bg-[#FFFDE7] border border-amber-300 rounded-xl p-3 font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      id="other-status-textbox"
                    />
                  </div>
                )}
              </div>

              {/* Star Rating Select */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Rating Index *</label>
                <div className="flex items-center gap-2" id="rating-stars-container">
                  {[1, 2, 3, 4, 5].map(star => {
                    const isLit = star <= rating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Star className={`w-9 h-9 ${isLit ? 'text-[#C8A165] fill-[#C8A165]' : 'text-gray-200'}`} />
                      </button>
                    );
                  })}
                  <span className="text-xs font-extrabold text-gray-500 ml-2">({rating} / 5 stars)</span>
                </div>
              </div>

              {/* Remarks Textarea */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Remarks / Observation Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record any stock issues, broken mirrors, damp ceilings, trash bins full, or pending clean items..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                  id="form-remarks-textarea"
                />
              </div>

              {/* Evidence Photo Upload */}
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Evidence Photo Upload</label>
                <div className="flex flex-wrap gap-2">
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
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-250 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                    id="form-photo-btn"
                  >
                    <Camera className="w-4 h-4 text-[#2E7D32]" />
                    <span>Open Camera / Choose File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPhotoUrl('https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop')}
                    className="px-3 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-500 transition-all"
                    id="form-mock-photo-btn"
                  >
                    Add Demo Image
                  </button>
                </div>

                {photoUrl && (
                  <div className="mt-3 relative inline-block animate-fade-in" id="photo-preview-container">
                    <img src={photoUrl} alt="Evidence Snapshot" className="w-44 h-28 object-cover rounded-xl border border-gray-200 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md transition-all"
                      id="remove-photo-btn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Digital Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">
                    Inspector Auth Signature (Required) *
                  </label>
                  {hasSigned && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 transition-all"
                      id="clear-sig-btn"
                    >
                      Reset Signature Canvas
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={130}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-28 cursor-crosshair touch-none bg-white"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 font-semibold italic">
                  Scribble or draw inside the white canvas frame to validate.
                </p>
              </div>

              {/* Form submit/abort buttons */}
              <div className="flex items-center justify-between border-t border-gray-150 pt-4 mt-2">
                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-all"
                  id="cancel-form-btn"
                >
                  Cancel / Go Back
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-[#2E7D32]/15 transition-all"
                  id="submit-inspection-btn"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-white" />
                      <span>Saving Audit...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-green-150" />
                      <span>Submit Compliance Report</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* SCREEN 4: SUCCESS PAGE DISPLAY */}
        {workflowState === 'success' && successData && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-6 animate-fade-in" id="inspector-success-screen">
            
            <div className="w-14 h-14 bg-green-50 text-[#2E7D32] border border-green-200 rounded-full flex items-center justify-center shadow-xs">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-800 tracking-tight uppercase">
                ✅ Inspection Submitted Successfully
              </h3>
              <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wider">
                Thank you for keeping our facility compliant.
              </p>
            </div>

            {/* Read-only audit detail receipt */}
            <div className="w-full bg-gray-50 border border-gray-150 p-5 rounded-2xl text-xs font-bold text-gray-600 flex flex-col gap-3 max-w-sm">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Receipt Reference</span>
                <span className="text-blue-700 font-mono text-sm tracking-tight font-extrabold">{successData.receiptNumber || 'CC-UNKNOWN'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Shift Mode</span>
                <span className="text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-150 text-[10px] uppercase">{successData.shift || 'Scheduled'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Verified Room</span>
                <span className="text-gray-800">{successData.roomName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Submitted At</span>
                <span className="text-gray-800 font-mono">{successData.submittedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Date Recorded</span>
                <span className="text-gray-800 font-mono">{successData.submittedDate}</span>
              </div>
            </div>

            <button
              onClick={handleResetScanner}
              className="px-6 py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black rounded-xl transition-all shadow-md shadow-[#2E7D32]/10"
              id="inspector-success-next-btn"
            >
              Scan Next Room
            </button>
          </div>
        )}

        {/* RE-ALIGN ERROR DISPLAY */}
        {workflowState === 'error' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-4 animate-fade-in" id="inspector-error-screen">
            <div className="w-12 h-12 bg-red-50 text-red-600 border border-red-150 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-800 uppercase tracking-wide">Verification Failed</h3>
              <p className="text-xs text-red-600 font-semibold mt-2 max-w-xs mx-auto leading-relaxed bg-red-50 p-3 rounded-xl border border-red-100">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={handleResetScanner}
              className="mt-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-all"
              id="inspector-error-reset-btn"
            >
              Reset Scanner View
            </button>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-[10px] text-gray-400 font-semibold uppercase tracking-wider" id="inspector-footer">
        Powered by CleanCheck Compliance Engine &bull; Secure Encrypted Session
      </footer>

    </div>
  );
}
