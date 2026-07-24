import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  Building,
  UserCheck,
  ShieldCheck,
  Key,
  Database,
  Eye,
  EyeOff,
  Bell,
  Search,
  Check,
  Menu,
  X
} from 'lucide-react';

// Import Types
import { 
  User, 
  Organization, 
  Building as BuildingType, 
  Floor as FloorType, 
  Room, 
  QrCodeDetails, 
  Inspection, 
  AppSettings, 
  AuditLog, 
  DashboardStats 
} from './types';

// Import Modular Tab Components
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import OrganizationsTab from './components/OrganizationsTab';
import LocationsTab from './components/LocationsTab';
import QrCodeTab from './components/QrCodeTab';
import ScannerTab from './components/ScannerTab';
import InspectionsTab from './components/InspectionsTab';
import LogsSettingsTab from './components/LogsSettingsTab';
import InspectorPortal from './components/InspectorPortal';
import AssignmentsTab from './components/AssignmentsTab';
import InspectorsTab from './components/InspectorsTab';
import ReportsTab from './components/ReportsTab';
import { Assignment } from './types';

export default function App() {
  
  // App Shell States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Notification and Global Search States
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; timestamp: Date; type: 'alert' | 'info' | 'success'; read: boolean }[]>([
    { id: '1', title: 'MongoDB Tunnel Active', message: 'Mongoose database connection established securely with replica pool.', timestamp: new Date(), type: 'success', read: false },
    { id: '2', title: 'Daily Backup Cycles Active', message: 'Automated 24-hour snapshot backup routines are validated.', timestamp: new Date(Date.now() - 3600000), type: 'info', read: true },
    { id: '3', title: 'Failing Inspection Alarm', message: 'Room 104 (Restroom) failed cleanliness audit standard.', timestamp: new Date(Date.now() - 7200000), type: 'alert', read: false }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);

  // Authentication Fields
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Forgot Password, Reset Password, Change Password states
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset' | 'change'>('login');
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [resetToken, setResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string }>({ score: 0, feedback: '' });

  // Master Data collections from APIs
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [buildings, setBuildings] = useState<BuildingType[]>([]);
  const [floors, setFloors] = useState<FloorType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [qrCodes, setQrCodes] = useState<QrCodeDetails[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Trigger Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to get authenticated headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('cleancheck_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  // Password strength validation helper
  const validatePasswordStrength = (pwd: string) => {
    let score = 0;
    let feedback = 'Very Weak';
    if (!pwd) return { score, feedback };

    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        feedback = 'Weak (Needs length/symbols)';
        break;
      case 2:
        feedback = 'Fair (Add mixed case & numbers)';
        break;
      case 3:
        feedback = 'Good (Add special symbols)';
        break;
      case 4:
        feedback = 'Strong Password';
        break;
      default:
        feedback = 'Very Weak';
    }
    return { score, feedback };
  };

  const handlePasswordChangeInput = (pwd: string) => {
    setNewPassword(pwd);
    setPasswordStrength(validatePasswordStrength(pwd));
  };

  // Manual trigger to flush cloud sync queue
  const handleRetrySync = async () => {
    try {
      const response = await fetch('/api/sync/retry', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ operatorUserId: currentUser?.id })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to retry synchronization.');
      }

      const data = await response.json();
      
      // Instantly load fresh stats to show updated syncState
      const statsRes = await fetch(`/api/dashboard?userId=${currentUser?.id}`, {
        headers: getAuthHeaders()
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (data.status === 'CONNECTED') {
        triggerToast('Synchronized successfully! All queued operations flushed to Firestore.');
      } else if (data.status === 'DEGRADED') {
        triggerToast('Synchronization failed. Please check administrator credentials or Firestore rules.');
      } else {
        triggerToast('Local changes are preserved offline. Connection will auto-resume.');
      }
    } catch (err: any) {
      console.error('[Sync Retry Error]', err);
      triggerToast(err.message || 'Server connection failed during retry.');
    }
  };

  // Re-fetch all operational metrics
  const fetchAllData = async () => {
    if (!currentUser) return;

    const headers = getAuthHeaders();

    // Security restriction: Inspector only loads rooms list for Simulator fallback
    if (currentUser.role === 'Inspector') {
      try {
        const roomsRes = await fetch(`/api/rooms?userId=${currentUser.id}`, { headers });
        if (roomsRes.ok) {
          const roomsData = await roomsRes.json();
          setRooms(roomsData);
        }
      } catch (err) {
        console.error('Failed to sync inspector rooms:', err);
      }
      return;
    }

    try {
      const uidQuery = `?userId=${currentUser.id}`;
      const [
        statsRes,
        orgsRes,
        bldRes,
        flrRes,
        roomsRes,
        qrsRes,
        insRes,
        settRes,
        logsRes,
        asgRes,
        usrRes
      ] = await Promise.all([
        fetch(`/api/dashboard${uidQuery}`, { headers }),
        fetch(`/api/organizations${uidQuery}`, { headers }),
        fetch(`/api/buildings${uidQuery}`, { headers }),
        fetch(`/api/floors${uidQuery}`, { headers }),
        fetch(`/api/rooms${uidQuery}`, { headers }),
        fetch(`/api/qr-codes${uidQuery}`, { headers }),
        fetch(`/api/inspections${uidQuery}`, { headers }),
        fetch(`/api/settings${uidQuery}`, { headers }),
        fetch(`/api/audit-logs${uidQuery}`, { headers }),
        fetch(`/api/assignments`, { headers }),
        fetch(`/api/users${uidQuery}`, { headers })
      ]);

      const [
        statsData,
        orgsData,
        bldData,
        flrData,
        roomsData,
        qrsData,
        insData,
        settData,
        logsData,
        asgData,
        usrData
      ] = await Promise.all([
        statsRes.json(),
        orgsRes.json(),
        bldRes.json(),
        flrRes.json(),
        roomsRes.json(),
        qrsRes.json(),
        insRes.json(),
        settRes.json(),
        logsRes.json(),
        asgRes.json(),
        usrRes.json()
      ]);

      const ensureArray = (data: any) => {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.data)) return data.data;
        if (data && Array.isArray(data.items)) return data.items;
        if (data && Array.isArray(data.assignments)) return data.assignments;
        return [];
      };

      setStats(statsData && !statsData.error ? statsData : null);
      setOrganizations(ensureArray(orgsData));
      setBuildings(ensureArray(bldData));
      setFloors(ensureArray(flrData));
      setRooms(ensureArray(roomsData));
      setQrCodes(ensureArray(qrsData));
      setInspections(ensureArray(insData));
      setSettings(settData);
      setAuditLogs(ensureArray(logsData));
      setAssignments(ensureArray(asgData));
      setUsers(ensureArray(usrData));
    } catch (err) {
      console.error('Operational database sync failed:', err);
    }
  };

  // Check for active login session in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('cleancheck_user');
    const savedToken = localStorage.getItem('cleancheck_token');
    if (savedUser && savedToken) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
      } catch (e) {
        console.error('Failed to restore active session:', e);
      }
    }
  }, []);

  // Fetch data automatically when a user session is active
  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  // --- API OPERATIONS ---

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: loginUsername.trim(),
          password: loginPassword 
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Authentication rejected. Please check credentials.');
      }

      const data = await response.json();
      setCurrentUser(data.user);
      localStorage.setItem('cleancheck_user', JSON.stringify(data.user));
      localStorage.setItem('cleancheck_token', data.sessionToken);
      
      triggerToast(`Welcome back, ${data.user.fullName}! Session unlocked.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Server connection failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Forgot Password Trigger
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Forgot password failed.');
      }

      const data = await response.json();
      triggerToast(data.message || 'If that email exists, we have generated a secure reset link.');
      setAuthView('reset');
    } catch (err: any) {
      setErrorMessage(err.message || 'Server connection failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim() || !newPassword) return;

    if (passwordStrength.score < 3) {
      setErrorMessage('Your new password must be at least "Good" strength (contain mixed cases, numbers, symbols)');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Reset password failed.');
      }

      triggerToast('Password reset successfully! Please sign in with your new credentials.');
      setAuthView('login');
      setNewPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Server connection failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Change Password Submit
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (passwordStrength.score < 3) {
      setErrorMessage('Your new password must be at least "Good" strength.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Password update failed.');
      }

      triggerToast('Password successfully changed! Session updated.');
      setAuthView('login');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Server connection failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (currentUser) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch (err) {
        console.error('Logout log failed:', err);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('cleancheck_user');
    localStorage.removeItem('cleancheck_token');
    setStats(null);
    triggerToast('Secure session closed. Cache purged.');
  };

  // Organizations CRUD
  const handleAddOrganization = async (org: { name: string; code: string; address: string; contactEmail: string }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...org })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      triggerToast(`Organization ${org.name} registered successfully!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to add organization');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      triggerToast(`Organization parameters modified successfully!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to update organization');
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this organization? All mapped buildings will be orphaned.")) return;
    
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      triggerToast("Organization permanently purged from ledger.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete organization');
    }
  };

  // Buildings CRUD
  const handleAddBuilding = async (bld: { organizationId: string; name: string; address: string }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...bld })
      });

      if (!response.ok) throw new Error('Failed to register building');
      triggerToast(`Building ${bld.name} successfully created!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBuilding = async (id: string) => {
    if (!window.confirm("Delete building? All floor layers will be disconnected.")) return;
    try {
      await fetch(`/api/buildings/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      triggerToast("Building deleted from facility matrix.");
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Floors CRUD
  const handleAddFloor = async (flr: { buildingId: string; name: string; level: number }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/floors', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...flr })
      });

      if (!response.ok) throw new Error('Failed to register floor');
      triggerToast(`Floor layer ${flr.name} created!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteFloor = async (id: string) => {
    if (!window.confirm("Remove floor level?")) return;
    try {
      await fetch(`/api/floors/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      triggerToast("Floor layer purged.");
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Rooms CRUD & QR creation
  const handleAddRoom = async (rm: { floorId: string; buildingId: string; name: string; type: string }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...rm })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to create room');
      }
      triggerToast(`Room ${rm.name} created & secure QR code badged!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this room? Associated QR badges will be permanently invalidated.")) return;
    try {
      await fetch(`/api/rooms/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      triggerToast("Room master record deleted.");
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBuilding = async (id: string, updates: Partial<BuildingType>) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/buildings/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });
      if (!response.ok) throw new Error('Failed to update building');
      triggerToast("Building details updated successfully!");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateFloor = async (id: string, updates: Partial<FloorType>) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/floors/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });
      if (!response.ok) throw new Error('Failed to update floor');
      triggerToast("Floor level updated successfully!");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRoom = async (id: string, updates: Partial<Room>) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/rooms/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });
      if (!response.ok) throw new Error('Failed to update room');
      triggerToast("Room details updated successfully!");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // QR Badging Actions
  const handleRegenerateQr = async (roomId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/qr-codes/regenerate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId })
      });

      if (!response.ok) throw new Error('Failed to refresh QR key');
      triggerToast("Secure QR Token mapping refreshed successfully.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleQr = async (roomId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/qr-codes/toggle', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId })
      });

      if (!response.ok) throw new Error('Failed to toggle QR');
      triggerToast("QR Code status updated.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform Inspection
  const handleAddInspection = async (inspection: {
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
  }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(inspection)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      const data = await response.json();
      await fetchAllData();
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save checklist');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteInspection = async (id: string) => {
    if (!window.confirm("Purge inspection audit log row?")) return;
    try {
      await fetch(`/api/inspections/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      triggerToast("Inspection log row deleted.");
      await fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAssignment = async (newAsg: Omit<Assignment, 'id' | 'createdAt' | 'inspectorName'> & { inspectorId: string }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...newAsg })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create assignment');
      }
      triggerToast("Daily shift assignment issued successfully!");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm("Recall daily shift assignment?")) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to recall assignment');
      }
      triggerToast("Shift assignment successfully recalled.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyInspection = async (id: string, status: 'Verified' | 'Rejected', remarks: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/inspections/${id}/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, supervisorRemarks: remarks })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Verification action failed');
      }
      triggerToast(`Audit inspection verified: set to ${status}.`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Users CRUD
  const handleAddUser = async (user: { username: string; email: string; fullName: string; role: string; organizationId?: string; password?: string }) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...user })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Failed to register user');
      }

      const resData = await response.json();
      const initialPwdMsg = resData.initialPassword ? ` (Initial Password: ${resData.initialPassword})` : '';
      triggerToast(`Staff member ${user.fullName} registered successfully!${initialPwdMsg}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update user');
      }

      triggerToast(`User parameters updated successfully!`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Permanently delete this user's profile and credentials?")) return;
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }

      triggerToast("User permanently purged from session registry.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Outgoing settings and sheets syncing
  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...updates })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      triggerToast("System parameter profiles successfully configured.");
      await fetchAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTriggerSheetsSync = async (): Promise<{ success: boolean; syncedCount: number; sheetId: string }> => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/sync/sheets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sync request failed');
      }

      const data = await response.json();
      await fetchAllData();
      return data;
    } catch (err: any) {
      alert(err.message);
      return { success: false, syncedCount: 0, sheetId: '' };
    } finally {
      setIsProcessing(false);
    }
  };

  // --- RENDERING ROUTER FLOW ---

  // 1. SIGN IN SCREEN if no user session found
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center items-center p-4 selection:bg-[#E8F5E9] font-sans">
        
        {/* Sign in card */}
        <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-md flex flex-col gap-6 relative overflow-hidden" id="login-container">
          
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#2E7D32]" />
          
          {/* Logo brand */}
          <div className="flex flex-col items-center text-center gap-3 mt-2">
            <div className="w-12 h-12 bg-[#2E7D32] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#2E7D32]/10">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1F2937] uppercase tracking-tight">CleanCheck</h1>
              <p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wider">Facility Compliance System</p>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-150 text-red-700 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fade-in" id="login-error">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VIEW: LOGIN */}
          {authView === 'login' && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Username or Email Address</label>
                <input
                  required
                  type="text"
                  placeholder="Enter username or email"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                  id="login-username-input"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Password</label>
                  <button 
                    type="button"
                    onClick={() => { setAuthView('forgot'); setErrorMessage(null); }}
                    className="text-[10px] font-extrabold text-[#2E7D32] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl pl-3.5 pr-12 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                    id="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="remember-me-chk"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#2E7D32] focus:ring-[#2E7D32] w-4 h-4 border-[#E9E5DE]"
                />
                <label htmlFor="remember-me-chk" className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                  Remember my session secure key
                </label>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white rounded-xl text-xs font-extrabold shadow-md shadow-[#2E7D32]/10 flex items-center justify-center gap-2 transition-all active:scale-98"
                id="login-submit-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-white" />
                    <span>Unlocking credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4.5 h-4.5 text-[#C8A165]" />
                    <span>Authenticate Credentials</span>
                  </>
                )}
              </button>

              <div className="text-center mt-1">
                <button
                  type="button"
                  onClick={() => { setAuthView('change'); setErrorMessage(null); }}
                  className="text-[10px] font-extrabold text-gray-400 hover:text-gray-600 uppercase tracking-wider"
                >
                  Change Existing Password
                </button>
              </div>
            </form>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {authView === 'forgot' && (
            <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Registered Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="Enter your registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[10px] font-bold leading-relaxed">
                SMTP Gateway Status: Automated email dispatch is unconfigured in v1.0.0. Secure reset tokens are routed directly to the system runtime console logs for admin-assisted credential restores. Please contact your system administrator.
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? 'Processing request...' : 'Generate Reset Token'}
              </button>

              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthView('login'); setErrorMessage(null); }}
                  className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-wider hover:underline"
                >
                  Back to Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthView('reset'); setErrorMessage(null); }}
                  className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider hover:underline"
                >
                  Have a Token? Reset Here
                </button>
              </div>
            </form>
          )}

          {/* VIEW: RESET PASSWORD */}
          {authView === 'reset' && (
            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Reset Authorization Token</label>
                <input
                  required
                  type="text"
                  placeholder="Enter the token printed in server logs"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">New Secure Password</label>
                <input
                  required
                  type="password"
                  placeholder="Must contain uppercase, lowercase, number, symbol"
                  value={newPassword}
                  onChange={(e) => handlePasswordChangeInput(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                />
                
                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex flex-col gap-1 animate-fade-in">
                    <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wide">
                      <span className="text-gray-400">Security Rating:</span>
                      <span className={
                        passwordStrength.score >= 3 ? 'text-green-600' : 'text-red-500'
                      }>
                        {passwordStrength.feedback}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.score === 1 ? 'w-1/4 bg-red-500' :
                          passwordStrength.score === 2 ? 'w-2/4 bg-orange-400' :
                          passwordStrength.score === 3 ? 'w-3/4 bg-blue-500' :
                          passwordStrength.score === 4 ? 'w-full bg-green-500' : 'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? 'Updating password...' : 'Apply Password Change'}
              </button>

              <button
                type="button"
                onClick={() => { setAuthView('login'); setErrorMessage(null); }}
                className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-wider text-center hover:underline mt-1"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: CHANGE PASSWORD */}
          {authView === 'change' && (
            <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Current Active Password</label>
                <input
                  required
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">New Secure Password</label>
                <input
                  required
                  type="password"
                  placeholder="Must contain uppercase, lowercase, number, symbol"
                  value={newPassword}
                  onChange={(e) => handlePasswordChangeInput(e.target.value)}
                  className="w-full text-sm bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold text-[#1F2937]"
                />
                
                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex flex-col gap-1 animate-fade-in">
                    <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wide">
                      <span className="text-gray-400">Security Rating:</span>
                      <span className={
                        passwordStrength.score >= 3 ? 'text-green-600' : 'text-red-500'
                      }>
                        {passwordStrength.feedback}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.score === 1 ? 'w-1/4 bg-red-500' :
                          passwordStrength.score === 2 ? 'w-2/4 bg-orange-400' :
                          passwordStrength.score === 3 ? 'w-3/4 bg-blue-500' :
                          passwordStrength.score === 4 ? 'w-full bg-green-500' : 'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? 'Updating password...' : 'Apply Password Change'}
              </button>

              <button
                type="button"
                onClick={() => { setAuthView('login'); setErrorMessage(null); }}
                className="text-[10px] font-extrabold text-[#2E7D32] uppercase tracking-wider text-center hover:underline mt-1"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* Version number and legal links */}
          <div className="flex justify-between items-center border-t border-gray-100 pt-4 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">
            <span>CleanCheck v1.0.0</span>
            <div className="flex gap-2.5">
              <a href="#privacy" className="hover:text-gray-600">Privacy Policy</a>
              <span>•</span>
              <a href="#terms" className="hover:text-gray-600">Terms of Service</a>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // 2. ACTIVE APPLICATION LAYOUT
  if (currentUser.role === 'Inspector') {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans" id="inspector-app-root">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#1F2937] text-white py-3.5 px-6 rounded-2xl shadow-xl flex items-center gap-3 border border-gray-700 transition-all animate-bounce" id="toast-alert">
            <Sparkles className="w-5 h-5 text-[#C8A165]" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        <InspectorPortal 
          currentUser={currentUser}
          rooms={rooms}
          assignments={assignments}
          inspections={inspections}
          onAddInspection={handleAddInspection}
          onLogout={handleLogout}
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  // Filter datasets based on Manager's organization if role is Organization Admin
  const orgId = currentUser.role === 'Organization Admin' ? currentUser.organizationId : null;

  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeQrCodes = Array.isArray(qrCodes) ? qrCodes : [];
  const safeInspections = Array.isArray(inspections) ? inspections : [];

  const filteredBuildings = orgId 
    ? safeBuildings.filter(b => b.organizationId === orgId) 
    : safeBuildings;

  const filteredBuildingsIds = filteredBuildings.map(b => b.id);

  const filteredFloors = orgId 
    ? safeFloors.filter(f => filteredBuildingsIds.includes(f.buildingId)) 
    : safeFloors;

  const filteredFloorsIds = filteredFloors.map(f => f.id);

  const filteredRooms = orgId 
    ? safeRooms.filter(r => filteredBuildingsIds.includes(r.buildingId) || filteredFloorsIds.includes(r.floorId)) 
    : safeRooms;

  const filteredRoomIds = filteredRooms.map(r => r.id);

  const filteredQrCodes = orgId 
    ? safeQrCodes.filter(q => filteredRoomIds.includes(q.roomId)) 
    : safeQrCodes;

  const filteredUsers = orgId 
    ? safeUsers.filter(u => u.organizationId === orgId) 
    : safeUsers;

  const filteredInspections = orgId 
    ? safeInspections.filter(i => filteredRoomIds.includes(i.roomId))
    : safeInspections;

  const filteredAssignments = orgId 
    ? safeAssignments.filter(a => filteredUsers.some(u => u.id === a.inspectorId))
    : safeAssignments;

  // Global search filtering
  const searchRooms = globalSearchQuery
    ? safeRooms.filter(r => r.name.toLowerCase().includes(globalSearchQuery.toLowerCase()))
    : [];
  const searchBuildings = globalSearchQuery
    ? safeBuildings.filter(b => b.name.toLowerCase().includes(globalSearchQuery.toLowerCase()))
    : [];
  const searchInspectors = globalSearchQuery
    ? safeUsers.filter(u => u.role === 'Inspector' && u.fullName.toLowerCase().includes(globalSearchQuery.toLowerCase()))
    : [];
  const hasSearchResults = globalSearchQuery && (searchRooms.length > 0 || searchBuildings.length > 0 || searchInspectors.length > 0);

  // 3. ADMIN APPLICATION LAYOUT
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1F2937] flex flex-col lg:flex-row font-sans selection:bg-[#E8F5E9] lg:h-screen lg:overflow-hidden" id="app-root">
      
      {/* Toast Alert Drawer */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F2937] text-white py-3.5 px-6 rounded-2xl shadow-xl flex items-center gap-3 border border-gray-700 transition-all animate-bounce" id="toast-alert">
          <Sparkles className="w-5 h-5 text-[#C8A165]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Container Content */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#FAFAF8] overflow-y-auto">
        
        {/* Main upper toolbar */}
        <header className="bg-white border-b border-[#E9E5DE] px-4 md:px-6 py-3.5 flex flex-col lg:flex-row justify-between items-center gap-3 shadow-xs relative" id="main-header">
          
          {/* Mobile Top Header Bar (< 1024px) */}
          <div className="lg:hidden flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl transition-colors shrink-0"
                aria-label="Open navigation menu"
                id="mobile-menu-toggle-btn"
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#2E7D32] flex items-center justify-center text-white shrink-0 font-bold shadow-xs">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-tight leading-none">CleanCheck</h1>
                  <p className="text-[9px] text-[#2E7D32] font-extrabold uppercase mt-0.5 tracking-wide">{activeTab}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-block bg-[#E8F5E9] text-[#2E7D32] font-extrabold text-[9px] px-2 py-1 rounded-md uppercase tracking-wider">
                {currentUser.role === 'Super Admin' ? 'Admin' : 'Org'}
              </span>
            </div>
          </div>

          {/* Desktop Active Tab Title (>= 1024px) */}
          <div className="hidden lg:block flex-shrink-0 text-left">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#2E7D32]">
              {activeTab === 'dashboard' && 'Operations Dashboard'}
              {activeTab === 'organizations' && 'Client Organizations Ledger'}
              {activeTab === 'facilities' && 'Facility Master Matrix'}
              {activeTab === 'buildings' && 'Facility Master Matrix'}
              {activeTab === 'floors' && 'Building Floor Levels'}
              {activeTab === 'rooms' && 'Cleanliness Auditor Rooms'}
              {activeTab === 'qrcodes' && 'QR Compliance Badging'}
              {activeTab === 'assignments' && 'Daily Shift & Room Assignments'}
              {activeTab === 'inspections' && 'Historical Inspections Database'}
              {activeTab === 'inspectors' && 'Active Field Inspectors'}
              {activeTab === 'reports' && 'Facility Reports & Analytics'}
              {activeTab === 'audit-logs' && 'Security Audit Logs'}
              {activeTab === 'profile' && 'User Security Profile'}
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Logged Session: CC-3814</p>
          </div>

          {/* Center: Global Search Bar */}
          <div className="flex-1 max-w-md w-full relative" id="header-global-search">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Global search rooms, buildings, or inspectors..."
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  setShowGlobalSearchResults(true);
                }}
                onFocus={() => setShowGlobalSearchResults(true)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#2E7D32] text-xs font-semibold rounded-xl outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Global Search Results Dropdown Popover */}
            {showGlobalSearchResults && globalSearchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto p-2" id="search-results-popover">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2 mb-2 px-2">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Search Results</span>
                  <button onClick={() => setGlobalSearchQuery('')} className="text-[10px] text-red-500 font-bold hover:underline">Clear</button>
                </div>

                {!hasSearchResults && (
                  <p className="text-xs text-gray-400 text-center py-4 font-semibold">No active matches found.</p>
                )}

                {searchRooms.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-[10px] font-extrabold text-[#2E7D32] uppercase px-2 py-1 bg-green-50 rounded-lg">Facilities / Rooms ({searchRooms.length})</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      {searchRooms.slice(0, 4).map(rm => (
                        <button
                          key={rm.id}
                          onClick={() => {
                            setActiveTab('rooms');
                            setGlobalSearchQuery('');
                            setShowGlobalSearchResults(false);
                          }}
                          className="text-left w-full px-2 py-1.5 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700 flex justify-between"
                        >
                          <span>{rm.name}</span>
                          <span className="text-[9px] text-gray-400 font-normal">Floor Level {rm.floorId}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchBuildings.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-[10px] font-extrabold text-blue-600 uppercase px-2 py-1 bg-blue-50 rounded-lg">Buildings ({searchBuildings.length})</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      {searchBuildings.slice(0, 4).map(b => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setActiveTab('buildings');
                            setGlobalSearchQuery('');
                            setShowGlobalSearchResults(false);
                          }}
                          className="text-left w-full px-2 py-1.5 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchInspectors.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold text-purple-600 uppercase px-2 py-1 bg-purple-50 rounded-lg">Active Inspectors ({searchInspectors.length})</h4>
                    <div className="flex flex-col gap-1 mt-1">
                      {searchInspectors.slice(0, 4).map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setActiveTab('inspectors');
                            setGlobalSearchQuery('');
                            setShowGlobalSearchResults(false);
                          }}
                          className="text-left w-full px-2 py-1.5 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700 flex justify-between"
                        >
                          <span>{u.fullName}</span>
                          <span className="text-[9px] bg-green-100 text-green-700 font-extrabold px-1.5 rounded-full">INSPECTOR</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action Tools: Notifications, Sync Tokens, Online Status */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            
            {/* Notification Bell Dropdown */}
            <div className="relative" id="header-notifications-bell">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 rounded-xl transition-all relative"
                title="System Notifications Center"
              >
                <Bell className="w-4 h-4 text-gray-600" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2" id="notifications-popover">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-1">
                    <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">System Notifications</span>
                    <button
                      onClick={() => {
                        setNotifications(notifications.map(n => ({ ...n, read: true })));
                        triggerToast('All notifications marked as read.');
                      }}
                      className="text-[10px] text-[#2E7D32] hover:text-[#1B5E20] font-extrabold"
                    >
                      Mark All Read
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No active system notifications.</p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-colors ${
                            n.read ? 'bg-white border-gray-100' : 'bg-green-50/40 border-green-100'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wide ${
                              n.type === 'alert' ? 'text-red-600' : n.type === 'success' ? 'text-emerald-600' : 'text-blue-600'
                            }`}>
                              {n.title}
                            </span>
                            <span className="text-[9px] text-gray-400 font-semibold">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-normal font-semibold">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTab(currentUser.role === 'Super Admin' ? 'organizations' : 'qrcodes')}
              className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all uppercase tracking-wide text-gray-500"
            >
              <Database className="w-3.5 h-3.5 text-gray-400" />
              Active Tokens: {filteredQrCodes.length}
            </button>

            <span className="inline-block bg-[#E8F5E9] border border-green-200 text-[#2E7D32] font-extrabold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0 select-none">
              ONLINE &bull; {currentUser.role}
            </span>
          </div>
        </header>

        {/* Dynamic Inner views container */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardTab 
              stats={{
                ...stats,
                todayChecksCount: filteredInspections.filter(i => {
                  const today = new Date().toISOString().split('T')[0];
                  return i.createdAt.startsWith(today);
                }).length,
                pendingRoomsCount: filteredRooms.length - filteredInspections.filter(i => {
                  const today = new Date().toISOString().split('T')[0];
                  return i.createdAt.startsWith(today) && i.cleaned;
                }).length,
                averageRating: filteredInspections.length > 0 
                  ? Number((filteredInspections.reduce((acc, curr) => acc + curr.rating, 0) / filteredInspections.length).toFixed(1)) 
                  : 5.0,
                failedInspectionsCount: filteredInspections.filter(i => !i.cleaned || i.rating < 3).length,
                totalOrganizations: organizations.length,
                totalBuildings: filteredBuildings.length,
                totalFloors: filteredFloors.length,
                totalRooms: filteredRooms.length,
                recentInspections: filteredInspections.slice(0, 10),
                activeManagersCount: stats?.activeManagersCount ?? users.filter(u => ['Organization Admin', 'Manager'].includes(u.role) && u.active).length,
                activeInspectorsCount: stats?.activeInspectorsCount ?? users.filter(u => u.role === 'Inspector' && u.active).length,
                weeklyAuditsCount: stats?.weeklyAuditsCount ?? filteredInspections.filter(i => new Date(i.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
                monthlyAuditsCount: stats?.monthlyAuditsCount ?? filteredInspections.filter(i => new Date(i.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
                qrScanSuccessCount: stats?.qrScanSuccessCount ?? filteredInspections.filter(i => i.status === 'Submitted').length,
                compliancePercentage: stats?.compliancePercentage ?? (filteredInspections.length > 0 ? parseFloat((((filteredInspections.length - filteredInspections.filter(i => !i.cleaned || i.rating < 3).length) / filteredInspections.length) * 100).toFixed(1)) : 100),
                assignedInspectionsCount: stats?.assignedInspectionsCount,
                completedAssignedCount: stats?.completedAssignedCount,
                pendingAssignedCount: stats?.pendingAssignedCount,
              }} 
              onNavigateToTab={setActiveTab} 
              onOpenScanRequest={() => setActiveTab(currentUser.role === 'Super Admin' ? 'organizations' : 'qrcodes')} 
              onRetrySync={handleRetrySync}
            />
          )}

          {/* TAB: ORGANIZATIONS */}
          {activeTab === 'organizations' && (
            <OrganizationsTab 
              organizations={organizations} 
              onAddOrganization={handleAddOrganization} 
              onUpdateOrganization={handleUpdateOrganization} 
              onDeleteOrganization={handleDeleteOrganization} 
              isProcessing={isProcessing} 
              buildings={buildings}
              floors={floors}
              rooms={rooms}
              qrCodes={qrCodes}
              users={users}
              settings={settings}
              onAddBuilding={handleAddBuilding}
              onDeleteBuilding={handleDeleteBuilding}
              onAddFloor={handleAddFloor}
              onDeleteFloor={handleDeleteFloor}
              onAddRoom={handleAddRoom}
              onDeleteRoom={handleDeleteRoom}
              onUpdateBuilding={handleUpdateBuilding}
              onUpdateFloor={handleUpdateFloor}
              onUpdateRoom={handleUpdateRoom}
              onRegenerateQr={handleRegenerateQr}
              onToggleQr={handleToggleQr}
              onUpdateSettings={handleUpdateSettings}
              onTriggerSheetsSync={handleTriggerSheetsSync}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {/* TAB: FACILITIES / LOCATIONS DIRECTORY */}
          {(activeTab === 'facilities' || activeTab === 'buildings' || activeTab === 'floors' || activeTab === 'rooms') && (
            <LocationsTab 
              organizations={organizations}
              buildings={filteredBuildings}
              floors={filteredFloors}
              rooms={filteredRooms}
              onAddBuilding={handleAddBuilding}
              onDeleteBuilding={handleDeleteBuilding}
              onAddFloor={handleAddFloor}
              onDeleteFloor={handleDeleteFloor}
              onAddRoom={handleAddRoom}
              onDeleteRoom={handleDeleteRoom}
              onUpdateBuilding={handleUpdateBuilding}
              onUpdateFloor={handleUpdateFloor}
              onUpdateRoom={handleUpdateRoom}
              isProcessing={isProcessing}
              currentUserRole={currentUser.role}
            />
          )}

          {/* TAB: QR CODES */}
          {activeTab === 'qrcodes' && (
            <QrCodeTab 
              qrCodes={filteredQrCodes}
              rooms={filteredRooms}
              buildings={filteredBuildings}
              floors={filteredFloors}
              onRegenerateQr={handleRegenerateQr}
              onToggleQr={handleToggleQr}
              isProcessing={isProcessing}
            />
          )}

          {/* TAB: ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <AssignmentsTab 
              assignments={filteredAssignments}
              users={filteredUsers}
              rooms={filteredRooms}
              buildings={filteredBuildings}
              floors={filteredFloors}
              onAddAssignment={handleAddAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              isProcessing={isProcessing}
            />
          )}

          {/* TAB: INSPECTIONS */}
          {activeTab === 'inspections' && (
            <InspectionsTab 
              inspections={filteredInspections}
              buildings={filteredBuildings}
              floors={filteredFloors}
              organizations={organizations}
              onDeleteInspection={handleDeleteInspection}
              onVerifyInspection={handleVerifyInspection}
              currentUserRole={currentUser.role}
            />
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsTab 
              currentUser={currentUser}
              buildings={filteredBuildings}
              floors={filteredFloors}
              rooms={filteredRooms}
              organizations={organizations}
              inspectors={filteredUsers.filter(u => u.role === 'Inspector')}
            />
          )}

          {/* TAB: INSPECTORS */}
          {activeTab === 'inspectors' && (
            <InspectorsTab 
              inspectors={filteredUsers.filter(u => u.role === 'Inspector')}
              inspections={filteredInspections}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              isProcessing={isProcessing}
            />
          )}

          {/* TAB: AUDIT LOGS */}
          {activeTab === 'audit-logs' && (
            <LogsSettingsTab 
              settings={settings}
              auditLogs={auditLogs}
              inspections={inspections}
              onUpdateSettings={handleUpdateSettings}
              onTriggerSheetsSync={handleTriggerSheetsSync}
              isProcessing={isProcessing}
              currentUserRole={currentUser.role}
              initialPanelMode="audit"
            />
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6 md:p-8 shadow-xs max-w-xl animate-fade-in" id="profile-panel">
              <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-gray-100">
                <img 
                  src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop"} 
                  alt={currentUser.fullName}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover"
                />
                <div className="text-center md:text-left flex flex-col gap-1.5">
                  <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest self-center md:self-start border border-green-200">
                    {currentUser.role}
                  </span>
                  <h3 className="text-xl font-extrabold text-[#1F2937] tracking-tight">{currentUser.fullName}</h3>
                  <p className="text-xs text-gray-500 font-medium">Verified System Administrator Profile</p>
                </div>
              </div>

              <div className="py-6 flex flex-col gap-4 text-xs font-semibold">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400 uppercase tracking-wider text-[10px]">User Account Email</span>
                  <span className="text-gray-700">{currentUser.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400 uppercase tracking-wider text-[10px]">Security Identifier ID</span>
                  <span className="text-gray-700 font-mono text-[11px]">{currentUser.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400 uppercase tracking-wider text-[10px]">Active Session Role</span>
                  <span className="text-[#2E7D32] font-extrabold">{currentUser.role}</span>
                </div>
                {currentUser.organizationId && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-400 uppercase tracking-wider text-[10px]">Client Organization Map</span>
                    <span className="text-gray-700 font-mono">{currentUser.organizationId}</span>
                  </div>
                )}
              </div>

              {/* Secure Scanning section inside Profile */}
              <div className="bg-[#E8F5E9]/50 border border-green-200 p-5 rounded-2xl flex flex-col gap-3 mt-2">
                <h4 className="font-extrabold text-[#2E7D32] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheck className="w-4.5 h-4.5" />
                  Trigger Compliance Auditor
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Unlock the on-site room camera scanner to validate QR badges, checklist facility cleanliness, and sync data instantly.
                </p>

                {/* Submitting custom Scanner Tab launcher inside active flow */}
                <div className="mt-2">
                  <ScannerTab 
                    currentUser={currentUser}
                    rooms={rooms}
                    onAddInspection={handleAddInspection}
                    isProcessing={isProcessing}
                  />
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

    </div>
  );
}
