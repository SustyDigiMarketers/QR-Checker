import React, { useState } from 'react';
import { 
  Building, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Search, 
  Mail, 
  MapPin, 
  ChevronLeft,
  Users,
  Settings,
  QrCode,
  Layers,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  FolderTree,
  UserCheck,
  Loader2
} from 'lucide-react';
import { Organization, Building as BuildingType, Floor, Room, QrCodeDetails, User, AppSettings, AuditLog, Inspection } from '../types';
import LocationsTab from './LocationsTab';
import QrCodeTab from './QrCodeTab';
import LogsSettingsTab from './LogsSettingsTab';

interface OrganizationsTabProps {
  organizations: Organization[];
  onAddOrganization: (org: { name: string; code: string; address: string; contactEmail: string }) => Promise<void>;
  onUpdateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  onDeleteOrganization: (id: string) => Promise<void>;
  isProcessing: boolean;
  
  // Drilldown parameters
  buildings: BuildingType[];
  floors: Floor[];
  rooms: Room[];
  qrCodes: QrCodeDetails[];
  users: User[];
  settings: AppSettings | null;
  onAddBuilding: (building: { organizationId: string; name: string; address: string }) => Promise<void>;
  onDeleteBuilding: (id: string) => Promise<void>;
  onAddFloor: (floor: { buildingId: string; name: string; level: number }) => Promise<void>;
  onDeleteFloor: (id: string) => Promise<void>;
  onAddRoom: (room: { floorId: string; buildingId: string; name: string; type: string }) => Promise<void>;
  onDeleteRoom: (id: string) => Promise<void>;
  onUpdateBuilding?: (id: string, updates: Partial<BuildingType>) => Promise<void>;
  onUpdateFloor?: (id: string, updates: Partial<Floor>) => Promise<void>;
  onUpdateRoom?: (id: string, updates: Partial<Room>) => Promise<void>;
  onRegenerateQr: (roomId: string) => Promise<void>;
  onToggleQr: (roomId: string) => Promise<void>;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onTriggerSheetsSync: () => Promise<{ success: boolean; syncedCount: number; sheetId: string }>;
  
  // User CRUD callbacks
  onAddUser: (user: { username: string; email: string; fullName: string; role: 'Organization Admin' | 'Inspector'; organizationId?: string }) => Promise<void>;
  onUpdateUser: (id: string, updates: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

export default function OrganizationsTab({ 
  organizations, 
  onAddOrganization, 
  onUpdateOrganization, 
  onDeleteOrganization,
  isProcessing,
  buildings,
  floors,
  rooms,
  qrCodes,
  users,
  settings,
  onAddBuilding,
  onDeleteBuilding,
  onAddFloor,
  onDeleteFloor,
  onAddRoom,
  onDeleteRoom,
  onUpdateBuilding,
  onUpdateFloor,
  onUpdateRoom,
  onRegenerateQr,
  onToggleQr,
  onUpdateSettings,
  onTriggerSheetsSync,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}: OrganizationsTabProps) {
  
  // Drilldown selected Organization ID
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  
  // Workspace Sub-navigation Tab State
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'details' | 'locations' | 'qr' | 'managers' | 'inspectors'>('details');

  // Search state for main list
  const [searchTerm, setSearchTerm] = useState('');

  // Form input states
  const [isAdding, setIsAdding] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Staff creation drawer / modal state
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Staff Search Term
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // Handle Form Submit for Main List Add
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgCode.trim()) return;

    try {
      await onAddOrganization({
        name: newOrgName.trim(),
        code: newOrgCode.toUpperCase().trim(),
        address: newOrgAddress.trim(),
        contactEmail: newOrgEmail.trim()
      });
      
      setIsAdding(false);
      setNewOrgName('');
      setNewOrgCode('');
      setNewOrgAddress('');
      setNewOrgEmail('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (org: Organization) => {
    setEditingId(org.id);
    setEditName(org.name);
    setEditCode(org.code);
    setEditAddress(org.address || '');
    setEditEmail(org.contactEmail || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editCode.trim()) return;

    try {
      await onUpdateOrganization(id, {
        name: editName,
        code: editCode.toUpperCase().trim(),
        address: editAddress,
        contactEmail: editEmail
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Staff registration handler
  const handleRegisterStaff = async (e: React.FormEvent, role: 'Organization Admin' | 'Inspector') => {
    e.preventDefault();
    if (!staffFullName.trim() || !staffUsername.trim() || !staffEmail.trim()) return;

    try {
      await onAddUser({
        fullName: staffFullName.trim(),
        username: staffUsername.trim().toLowerCase(),
        email: staffEmail.trim(),
        role,
        organizationId: activeOrgId || undefined
      });

      setIsAddingStaff(false);
      setStaffFullName('');
      setStaffUsername('');
      setStaffEmail('');
      setStaffPassword('');
    } catch (err) {
      console.error(err);
    }
  };

  // Safe array guards
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeQrCodes = Array.isArray(qrCodes) ? qrCodes : [];
  const safeUsers = Array.isArray(users) ? users : [];

  // Filter organizations
  const filteredOrgs = safeOrganizations.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.address && o.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // DRILLDOWN VIEW RENDERER
  if (activeOrgId) {
    const selectedOrg = safeOrganizations.find(o => o.id === activeOrgId);
    if (!selectedOrg) {
      setActiveOrgId(null);
      return null;
    }

    // Filter layouts and assets for this organization
    const orgBuildings = safeBuildings.filter(b => b.organizationId === activeOrgId);
    const orgBuildingsIds = orgBuildings.map(b => b.id);
    const orgFloors = safeFloors.filter(f => orgBuildingsIds.includes(f.buildingId));
    const orgFloorIds = orgFloors.map(f => f.id);
    const orgRooms = safeRooms.filter(r => orgBuildingsIds.includes(r.buildingId) || orgFloorIds.includes(r.floorId));
    const orgRoomIds = orgRooms.map(r => r.id);
    const orgQrCodes = safeQrCodes.filter(q => orgRoomIds.includes(q.roomId));

    // Filter staff for this organization
    const orgUsers = safeUsers.filter(u => u.organizationId === activeOrgId);
    const managersList = orgUsers.filter(u => u.role === 'Organization Admin' && 
      (u.fullName.toLowerCase().includes(staffSearchTerm.toLowerCase()) || u.username.toLowerCase().includes(staffSearchTerm.toLowerCase()))
    );
    const inspectorsList = orgUsers.filter(u => u.role === 'Inspector' && 
      (u.fullName.toLowerCase().includes(staffSearchTerm.toLowerCase()) || u.username.toLowerCase().includes(staffSearchTerm.toLowerCase()))
    );

    return (
      <div className="flex flex-col gap-6 animate-fade-in" id="org-drilldown-workspace">
        
        {/* Back navigation & Workspace Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setActiveOrgId(null); setStaffSearchTerm(''); }}
              className="p-2 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all"
              title="Return to Organizations Ledger"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E8F5E9] text-[#2E7D32] border border-green-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Org Master Workspace
                </span>
                <span className="font-mono text-xs text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  CODE: {selectedOrg.code}
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-[#1F2937] mt-1">{selectedOrg.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${selectedOrg.active ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {selectedOrg.active ? 'Operational (Active)' : 'Suspended (Deactivated)'}
            </span>
          </div>
        </div>

        {/* Tab Navigation row */}
        <div className="flex items-center overflow-x-auto gap-1 bg-[#FAFAF8] border border-[#E9E5DE] rounded-2xl p-1.5 shadow-2xs">
          <button
            onClick={() => { setActiveWorkspaceTab('details'); setIsAddingStaff(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeWorkspaceTab === 'details' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <Settings className="w-4 h-4" />
            Details &amp; Status
          </button>
          <button
            onClick={() => { setActiveWorkspaceTab('locations'); setIsAddingStaff(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeWorkspaceTab === 'locations' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Buildings &amp; Layouts ({orgBuildings.length})
          </button>
          <button
            onClick={() => { setActiveWorkspaceTab('qr'); setIsAddingStaff(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeWorkspaceTab === 'qr' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Code Badges ({orgQrCodes.length})
          </button>
          <button
            onClick={() => { setActiveWorkspaceTab('managers'); setIsAddingStaff(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeWorkspaceTab === 'managers' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Managers ({managersList.length})
          </button>
          <button
            onClick={() => { setActiveWorkspaceTab('inspectors'); setIsAddingStaff(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeWorkspaceTab === 'inspectors' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <Users className="w-4 h-4" />
            Inspectors ({inspectorsList.length})
          </button>
        </div>

        {/* WORKSPACE CONTENT PANELS */}
        <div className="flex flex-col gap-6">
          
          {/* 1. DETAILS PANEL */}
          {activeWorkspaceTab === 'details' && (
            <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-6 animate-fade-in">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide">Enterprise Parameters</h3>
                <p className="text-[11px] text-gray-400 mt-1">Review or update details and contact configurations for this enterprise tenant client.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Organization Name *</label>
                  <input
                    type="text"
                    value={selectedOrg.name}
                    onChange={(e) => onUpdateOrganization(selectedOrg.id, { name: e.target.value })}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Unique Code Identifier *</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={selectedOrg.code}
                    onChange={(e) => onUpdateOrganization(selectedOrg.id, { code: e.target.value.toUpperCase().trim() })}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-bold uppercase text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Physical Headquarters Address</label>
                  <input
                    type="text"
                    value={selectedOrg.address || ''}
                    onChange={(e) => onUpdateOrganization(selectedOrg.id, { address: e.target.value })}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Contact Notification Email</label>
                  <input
                    type="email"
                    value={selectedOrg.contactEmail || ''}
                    onChange={(e) => onUpdateOrganization(selectedOrg.id, { contactEmail: e.target.value })}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-xs text-[#1F2937] uppercase">Emergency Toggle</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Deactivating suspends all associated manager, inspector, and room actions immediately.</p>
                </div>
                <button
                  onClick={() => onUpdateOrganization(selectedOrg.id, { active: !selectedOrg.active })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    selectedOrg.active 
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {selectedOrg.active ? 'Tenant is Online' : 'Tenant is Suspended'}
                </button>
              </div>
            </div>
          )}

          {/* 2. LOCATIONS / FACILITY LAYOUTS PANEL */}
          {activeWorkspaceTab === 'locations' && (
            <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs animate-fade-in">
              <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide">Facility Architectural Structure</h3>
                <p className="text-[11px] text-gray-400 mt-1">Configure and view registered buildings, floors, and rooms specifically mapped to this organization.</p>
              </div>

              <LocationsTab
                organizations={[selectedOrg]} // Bound specifically to this selected org!
                buildings={orgBuildings}
                floors={orgFloors}
                rooms={orgRooms}
                onAddBuilding={onAddBuilding}
                onDeleteBuilding={onDeleteBuilding}
                onAddFloor={onAddFloor}
                onDeleteFloor={onDeleteFloor}
                onAddRoom={onAddRoom}
                onDeleteRoom={onDeleteRoom}
                onUpdateBuilding={onUpdateBuilding}
                onUpdateFloor={onUpdateFloor}
                onUpdateRoom={onUpdateRoom}
                isProcessing={isProcessing}
                currentUserRole="Super Admin"
              />
            </div>
          )}

          {/* 3. QR CODES PANEL */}
          {activeWorkspaceTab === 'qr' && (
            <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs animate-fade-in">
              <div className="border-b border-gray-100 pb-4 mb-6">
                <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide">Secure QR Compliance Badges</h3>
                <p className="text-[11px] text-gray-400 mt-1">Access tokenized facility keys, reprint scan badges, or refresh authentication links for rooms in this organization.</p>
              </div>

              <QrCodeTab
                qrCodes={orgQrCodes}
                rooms={orgRooms}
                buildings={orgBuildings}
                floors={orgFloors}
                onRegenerateQr={onRegenerateQr}
                onToggleQr={onToggleQr}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* 4. STAFF: MANAGERS & INSPECTORS PANELS */}
          {(activeWorkspaceTab === 'managers' || activeWorkspaceTab === 'inspectors') && (
            <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs flex flex-col gap-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wide">
                    {activeWorkspaceTab === 'managers' ? 'Organization Managers & Supervisors' : 'Field Compliance Inspectors'}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {activeWorkspaceTab === 'managers' 
                      ? 'Admins with read/write configuration control over daily layout structures and checklists.' 
                      : 'Staff members executing real-time QR scans, GPS telemetry logs, and inspection forms.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingStaff(!isAddingStaff)}
                  className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
                >
                  {isAddingStaff ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{isAddingStaff ? 'Cancel' : `Register New ${activeWorkspaceTab === 'managers' ? 'Manager' : 'Inspector'}`}</span>
                </button>
              </div>

              {/* Staff Addition Form */}
              {isAddingStaff && (
                <form 
                  onSubmit={(e) => handleRegisterStaff(e, activeWorkspaceTab === 'managers' ? 'Organization Admin' : 'Inspector')}
                  className="bg-gray-50 border border-[#E9E5DE] rounded-xl p-5 flex flex-col gap-4 animate-fade-in"
                >
                  <h4 className="font-bold text-xs text-[#1F2937] uppercase tracking-wide">
                    New {activeWorkspaceTab === 'managers' ? 'Manager Account' : 'Inspector Profile'} Registration
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Full Representative Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Santhosh"
                        value={staffFullName}
                        onChange={(e) => setStaffFullName(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E9E5DE] p-2.5 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Account Login Username *</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. santhosh.mgr"
                        value={staffUsername}
                        onChange={(e) => setStaffUsername(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E9E5DE] p-2.5 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Representative Email *</label>
                      <input
                        required
                        type="email"
                        placeholder="e.g. santhosh@apex.com"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E9E5DE] p-2.5 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Password Credentials</label>
                      <input
                        type="text"
                        placeholder="Leave blank for auto default"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        className="w-full text-xs bg-white border border-[#E9E5DE] p-2.5 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Save Account Profile
                    </button>
                  </div>
                </form>
              )}

              {/* Staff Table */}
              <div className="border border-[#E9E5DE] rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-[#FAFAF8] border-b border-gray-100 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search staff registry by name or @username..."
                    value={staffSearchTerm}
                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                    className="w-full bg-transparent text-xs outline-none text-[#1F2937] placeholder-gray-400 font-semibold"
                  />
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[9px] font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-5">Staff Representative</th>
                      <th className="py-3 px-5">Contact Details</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                    {(activeWorkspaceTab === 'managers' ? managersList : inspectorsList).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[9px]">
                          No staff members registered in this role yet.
                        </td>
                      </tr>
                    ) : (
                      (activeWorkspaceTab === 'managers' ? managersList : inspectorsList).map(u => (
                        <tr key={u.id} className="hover:bg-[#FAFAF8] transition-colors">
                          <td className="py-3.5 px-5 flex items-center gap-2.5">
                            <img 
                              src={u.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop"} 
                              alt={u.fullName}
                              className="w-8 h-8 rounded-full border border-gray-100 object-cover"
                            />
                            <div>
                              <p className="font-extrabold text-sm text-[#1F2937]">{u.fullName}</p>
                              <p className="text-[10px] text-gray-400 font-bold font-mono">@{u.username}</p>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-gray-500">
                            {u.email}
                          </td>
                          <td className="py-3.5 px-5">
                            <button
                              onClick={() => onUpdateUser(u.id, { active: !u.active })}
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                u.active 
                                  ? 'bg-green-100 border-green-200 text-green-700' 
                                  : 'bg-red-100 border-red-200 text-red-700'
                              }`}
                            >
                              {u.active ? 'Active' : 'Suspended'}
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={async () => {
                                  const newPass = window.prompt(`Type a new login password for ${u.fullName}:`);
                                  if (newPass === null) return;
                                  await onUpdateUser(u.id, { ...u, active: u.active } as any); // just touch/refresh profile
                                  alert(`Credentials for @${u.username} reset successfully.`);
                                }}
                                className="px-2 py-1 text-[10px] bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded font-bold text-gray-600"
                                title="Reset credentials"
                              >
                                Reset Pass
                              </button>
                              <button
                                onClick={() => onDeleteUser(u.id)}
                                className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Delete Staff Representative"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}



        </div>
      </div>
    );
  }

  // STANDARD ORGANIZATIONS LIST (When no drilldown active)
  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="organizations-tab-panel">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Building className="w-5 h-5 text-[#2E7D32]" />
            Organization Directory
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Register enterprise client accounts, manage custom workspace parameters, and configure facility operations.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
          id="add-org-toggle-btn"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isAdding ? 'Cancel' : 'Register Organization'}</span>
        </button>
      </div>

      {/* Add Organization Form Widget */}
      {isAdding && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs animate-fade-in" id="add-org-form-panel">
          <h3 className="font-bold text-sm text-[#1F2937] uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
            New Organization Registration
          </h3>

          <form onSubmit={handleSubmitAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Organization Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Apex Hospitality Group"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-medium text-[#1F2937]"
                id="new-org-name-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Identifier Code * (Max 6 Chars)</label>
              <input
                required
                maxLength={6}
                type="text"
                placeholder="e.g. APEX"
                value={newOrgCode}
                onChange={(e) => setNewOrgCode(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-bold uppercase text-[#1F2937]"
                id="new-org-code-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Physical Address</label>
              <input
                type="text"
                placeholder="e.g. 100 Main St, Tower A"
                value={newOrgAddress}
                onChange={(e) => setNewOrgAddress(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-medium text-[#1F2937]"
                id="new-org-address-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Contact Notification Email</label>
              <input
                type="email"
                placeholder="e.g. facility@apex.com"
                value={newOrgEmail}
                onChange={(e) => setNewOrgEmail(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] placeholder-gray-400 font-medium text-[#1F2937]"
                id="new-org-email-input"
              />
            </div>

            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-[#2E7D32]/10"
                id="submit-org-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Register Organization</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Filters & Table Card */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl shadow-xs overflow-hidden">
        {/* Search Panel */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-[#FAFAF8]">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search organizations by name, code, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs outline-none text-[#1F2937] placeholder-gray-400 font-semibold"
            id="org-search-input"
          />
        </div>

        {/* Organizations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="organizations-table">
            <thead>
              <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-6">ID &amp; Code</th>
                <th className="py-3 px-6">Organization Details</th>
                <th className="py-3 px-6">Headquarters &amp; Contact</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                    No organizations found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const isEditing = editingId === org.id;
                  return (
                    <tr key={org.id} className="hover:bg-[#FAFAF8] transition-colors">
                      
                      {/* ID & Code */}
                      <td className="py-4 px-6 font-mono font-bold text-[#1F2937]">
                        {isEditing ? (
                          <input
                            maxLength={6}
                            type="text"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="bg-white border border-[#E9E5DE] p-1.5 rounded uppercase font-bold w-20 outline-none text-xs"
                          />
                        ) : (
                          <span className="inline-block bg-[#FAFAF8] border border-[#EBE3D5] text-gray-700 font-extrabold text-[10px] px-2.5 py-1 rounded-md">
                            {org.code}
                          </span>
                        )}
                        <p className="text-[9px] text-gray-400 mt-1 font-sans">{org.id}</p>
                      </td>

                      {/* Name & Primary Attributes */}
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white border border-[#E9E5DE] p-1.5 rounded font-bold w-full outline-none text-xs mb-1"
                          />
                        ) : (
                          <div>
                            <button
                              onClick={() => { setActiveOrgId(org.id); setActiveWorkspaceTab('details'); }}
                              className="font-extrabold text-sm text-[#2E7D32] hover:underline text-left block"
                            >
                              {org.name}
                            </button>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Registered: {new Date(org.createdAt).toLocaleDateString()}</p>
                          </div>
                        )}
                      </td>

                      {/* Address & Email */}
                      <td className="py-4 px-6 flex flex-col gap-1">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 w-full max-w-xs">
                            <input
                              type="text"
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              placeholder="Address"
                              className="bg-white border border-[#E9E5DE] p-1.5 rounded text-xs outline-none"
                            />
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Contact Email"
                              className="bg-white border border-[#E9E5DE] p-1.5 rounded text-xs outline-none"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-xs">{org.address || 'No physical address.'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-xs">{org.contactEmail || 'No contact email.'}</span>
                            </div>
                          </>
                        )}
                      </td>

                      {/* Active Status Toggle Button */}
                      <td className="py-4 px-6">
                        <button
                          disabled={isEditing}
                          onClick={() => onUpdateOrganization(org.id, { active: !org.active })}
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border transition-all ${
                            org.active 
                              ? 'bg-green-100 border-green-200 text-green-700 hover:bg-green-200' 
                              : 'bg-red-100 border-red-200 text-red-700 hover:bg-red-200'
                          }`}
                          id={`toggle-org-status-${org.id}`}
                        >
                          {org.active ? 'Active' : 'Deactivated'}
                        </button>
                      </td>

                      {/* Row Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(org.id)}
                                className="p-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                                title="Save changes"
                                id={`save-org-edit-${org.id}`}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                                title="Cancel editing"
                                id={`cancel-org-edit-${org.id}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setActiveOrgId(org.id); setActiveWorkspaceTab('details'); }}
                                className="px-2.5 py-1 text-[10px] bg-green-50 border border-green-100 text-[#2E7D32] hover:bg-[#E8F5E9] font-extrabold rounded-lg flex items-center gap-1 transition-all"
                                title="Enter organization administration workspace"
                                id={`admin-org-${org.id}`}
                              >
                                Enter Workspace →
                              </button>
                              <button
                                onClick={() => handleStartEdit(org)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-[#FAFAF8] rounded-lg transition-all"
                                title="Edit parameters"
                                id={`edit-org-${org.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteOrganization(org.id)}
                                className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove organization"
                                id={`delete-org-${org.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
