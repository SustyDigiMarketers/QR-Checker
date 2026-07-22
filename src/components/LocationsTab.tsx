import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Layers, 
  FolderTree, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  MapPin, 
  QrCode,
  Tag,
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Home,
  Folder,
  FileText,
  LayoutGrid
} from 'lucide-react';
import { Organization, Building, Floor, Room } from '../types';

interface LocationsTabProps {
  organizations: Organization[];
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  onAddBuilding: (building: { organizationId: string; name: string; address: string }) => Promise<void>;
  onDeleteBuilding: (id: string) => Promise<void>;
  onAddFloor: (floor: { buildingId: string; name: string; level: number }) => Promise<void>;
  onDeleteFloor: (id: string) => Promise<void>;
  onAddRoom: (room: { floorId: string; buildingId: string; name: string; type: string }) => Promise<void>;
  onDeleteRoom: (id: string) => Promise<void>;
  onUpdateBuilding?: (id: string, updates: Partial<Building>) => Promise<void>;
  onUpdateFloor?: (id: string, updates: Partial<Floor>) => Promise<void>;
  onUpdateRoom?: (id: string, updates: Partial<Room>) => Promise<void>;
  isProcessing: boolean;
  currentUserRole?: string;
}

export default function LocationsTab({
  organizations,
  buildings,
  floors,
  rooms,
  onAddBuilding,
  onDeleteBuilding,
  onAddFloor,
  onDeleteFloor,
  onAddRoom,
  onDeleteRoom,
  onUpdateBuilding,
  onUpdateFloor,
  onUpdateRoom,
  isProcessing,
  currentUserRole
}: LocationsTabProps) {

  // Inner navigation tabs: 'explorer' | 'buildings' | 'floors' | 'rooms'
  const [subTab, setSubTab] = useState<'explorer' | 'buildings' | 'floors' | 'rooms'>('explorer');

  // Directory expansion trackers (default to expanded)
  const [expandedBlds, setExpandedBlds] = useState<Record<string, boolean>>({});
  const [expandedFlrs, setExpandedFlrs] = useState<Record<string, boolean>>({});

  // Inline Editing states
  const [editingBldId, setEditingBldId] = useState<string | null>(null);
  const [editingBldName, setEditingBldName] = useState('');
  const [editingBldAddress, setEditingBldAddress] = useState('');

  const [editingFlrId, setEditingFlrId] = useState<string | null>(null);
  const [editingFlrName, setEditingFlrName] = useState('');
  const [editingFlrLevel, setEditingFlrLevel] = useState(0);

  const [editingRmId, setEditingRmId] = useState<string | null>(null);
  const [editingRmName, setEditingRmName] = useState('');
  const [editingRmType, setEditingRmType] = useState('Restroom');

  const toggleBldExpanded = (id: string) => {
    setExpandedBlds(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  const toggleFlrExpanded = (id: string) => {
    setExpandedFlrs(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  // Submit Building edits
  const handleSaveBuildingEdit = async (id: string) => {
    if (!editingBldName.trim() || !onUpdateBuilding) return;
    try {
      await onUpdateBuilding(id, { name: editingBldName.trim(), address: editingBldAddress.trim() });
      setEditingBldId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Floor edits
  const handleSaveFloorEdit = async (id: string) => {
    if (!editingFlrName.trim() || !onUpdateFloor) return;
    try {
      await onUpdateFloor(id, { name: editingFlrName.trim(), level: editingFlrLevel });
      setEditingFlrId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Room edits
  const handleSaveRoomEdit = async (id: string) => {
    if (!editingRmName.trim() || !onUpdateRoom) return;
    try {
      await onUpdateRoom(id, { name: editingRmName.trim(), type: editingRmType });
      setEditingRmId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Add Panel state toggles
  const [isAdding, setIsAdding] = useState(false);

  // Form states: Building
  const [bldOrgId, setBldOrgId] = useState(organizations[0]?.id || '');
  const [bldName, setBldName] = useState('');
  const [bldAddress, setBldAddress] = useState('');

  useEffect(() => {
    if (!bldOrgId && organizations.length > 0) {
      setBldOrgId(organizations[0].id);
    }
  }, [organizations, bldOrgId]);

  // Form states: Floor
  const [flrBldId, setFlrBldId] = useState('');
  const [flrName, setFlrName] = useState('');
  const [flrLevel, setFlrLevel] = useState(0);

  // Form states: Room
  const [rmBldId, setRmBldId] = useState('');
  const [rmFlrId, setRmFlrId] = useState('');
  const [rmName, setRmName] = useState('');
  const [rmType, setRmType] = useState('Restroom');

  // Filter lists based on building selection during room setup
  const availableFloorsForRoom = floors.filter(f => f.buildingId === rmBldId);

  // Submit Building
  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldOrgId || !bldName.trim()) return;

    try {
      await onAddBuilding({
        organizationId: bldOrgId,
        name: bldName.trim(),
        address: bldAddress.trim()
      });
      setIsAdding(false);
      setBldName('');
      setBldAddress('');
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Floor
  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flrBldId || !flrName.trim()) return;

    try {
      await onAddFloor({
        buildingId: flrBldId,
        name: flrName.trim(),
        level: flrLevel
      });
      setIsAdding(false);
      setFlrName('');
      setFlrLevel(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Room
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmBldId || !rmFlrId || !rmName.trim() || !rmType) return;

    try {
      await onAddRoom({
        buildingId: rmBldId,
        floorId: rmFlrId,
        name: rmName.trim(),
        type: rmType
      });
      setIsAdding(false);
      setRmName('');
      setRmType('Restroom');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="locations-master-panel">
      {/* Upper Tab Selection row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-1 shadow-2xs" id="locations-subtabs">
          <button
            onClick={() => { setSubTab('explorer'); setIsAdding(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'explorer' ? 'bg-[#2E7D32] text-white shadow-sm' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Facility Tree Explorer
          </button>
          <button
            onClick={() => { setSubTab('buildings'); setIsAdding(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'buildings' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Buildings ({buildings.length})
          </button>
          <button
            onClick={() => { setSubTab('floors'); setIsAdding(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'floors' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Floors ({floors.length})
          </button>
          <button
            onClick={() => { setSubTab('rooms'); setIsAdding(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'rooms' ? 'bg-[#2E7D32] text-white' : 'text-gray-500 hover:text-[#1F2937]'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            Rooms &amp; QR badging ({rooms.length})
          </button>
        </div>

        {subTab !== 'explorer' && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAdding ? 'Cancel' : `Add ${subTab === 'buildings' ? 'Building' : subTab === 'floors' ? 'Floor Level' : 'Inspection Room'}`}</span>
          </button>
        )}
      </div>

      {/* Dynamic Creation Forms */}
      {isAdding && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs animate-fade-in" id="add-location-form-panel">
          
          {/* Building Form */}
          {subTab === 'buildings' && (
            <form onSubmit={handleAddBuilding} className="flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#1F2937] uppercase tracking-wide border-b border-gray-100 pb-2">Add Registered Building</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Belongs to Organization *</label>
                  <select
                    required
                    value={bldOrgId}
                    onChange={(e) => setBldOrgId(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  >
                    <option value="">Select Organization...</option>
                    {organizations.filter(o => o.active).map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Building Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Headquarters East"
                    value={bldName}
                    onChange={(e) => setBldName(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Building Location/Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 500 Tech Parkway"
                    value={bldAddress}
                    onChange={(e) => setBldAddress(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Building
                </button>
              </div>
            </form>
          )}

          {/* Floor Form */}
          {subTab === 'floors' && (
            <form onSubmit={handleAddFloor} className="flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#1F2937] uppercase tracking-wide border-b border-gray-100 pb-2">Add Floor Level</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Belongs to Building *</label>
                  <select
                    required
                    value={flrBldId}
                    onChange={(e) => setFlrBldId(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  >
                    <option value="">Select Building...</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Floor Display Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Basement 1, First Floor"
                    value={flrName}
                    onChange={(e) => setFlrName(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Numeric Level Index (0=Ground, 1=1st)</label>
                  <input
                    type="number"
                    value={flrLevel}
                    onChange={(e) => setFlrLevel(parseInt(e.target.value, 10))}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-bold text-[#1F2937]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Floor Level
                </button>
              </div>
            </form>
          )}

          {/* Room Form */}
          {subTab === 'rooms' && (
            <form onSubmit={handleAddRoom} className="flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#1F2937] uppercase tracking-wide border-b border-gray-100 pb-2">Create Room &amp; Map QR Badging</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Belongs to Building *</label>
                  <select
                    required
                    value={rmBldId}
                    onChange={(e) => { setRmBldId(e.target.value); setRmFlrId(''); }}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  >
                    <option value="">Select Building...</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Belongs to Floor *</label>
                  <select
                    required
                    disabled={!rmBldId}
                    value={rmFlrId}
                    onChange={(e) => setRmFlrId(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937] disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Select Floor Level...</option>
                    {availableFloorsForRoom.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Room Facility Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Restroom Lobby Area, Suite 402"
                    value={rmName}
                    onChange={(e) => setRmName(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Room Type Category</label>
                  <select
                    value={rmType}
                    onChange={(e) => setRmType(e.target.value)}
                    className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-3 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
                  >
                    <option value="Restroom">Restroom / Washroom</option>
                    <option value="Kitchen">Kitchenette / Cafeteria</option>
                    <option value="Office">Office / Workspaces</option>
                    <option value="Conference">Conference Room</option>
                    <option value="Other">Other / Public Atrium</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save &amp; Generate QR Token
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {/* Hierarchical Tree Explorer */}
      {subTab === 'explorer' && (
        <div className="flex flex-col gap-4 animate-fade-in" id="hierarchy-tree-explorer">
          <div className="flex justify-between items-center bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl px-4 py-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
              Facility Directory &bull; Hierarchical Asset Map
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allExpanded: Record<string, boolean> = {};
                  buildings.forEach(b => { allExpanded[b.id] = true; });
                  floors.forEach(f => { allExpanded[f.id] = true; });
                  setExpandedBlds(allExpanded);
                  setExpandedFlrs(allExpanded);
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-[#2E7D32] hover:bg-[#2E7D32]/10 rounded-lg transition-all border border-gray-200 bg-white"
              >
                Expand All
              </button>
              <button
                onClick={() => {
                  setExpandedBlds({});
                  setExpandedFlrs({});
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-all border border-gray-200 bg-white"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs">
            {buildings.length === 0 ? (
              <div className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider text-[11px] flex flex-col items-center gap-3">
                <LayoutGrid className="w-8 h-8 text-gray-300" />
                No buildings or spaces setup for this Organization yet.
                <button
                  onClick={() => { setSubTab('buildings'); setIsAdding(true); }}
                  className="mt-2 px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[11px] font-bold rounded-xl transition-all"
                >
                  Setup First Building
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  const orgIds = Array.from(new Set(buildings.map(b => b.organizationId)));
                  return orgIds.map(orgId => {
                    const org = organizations.find(o => o.id === orgId);
                    const orgBuildings = buildings.filter(b => b.organizationId === orgId);
                    
                    return (
                      <div key={orgId || 'unmapped'} className="border border-gray-100 rounded-xl overflow-hidden shadow-2xs bg-gray-50/20">
                        {/* Organization Row */}
                        <div className="flex items-center gap-2 bg-[#FAFAF8] border-b border-gray-100 px-4 py-3">
                          <Home className="w-4 h-4 text-[#2E7D32]" />
                          <span className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wide">
                            {org ? org.name : 'Organization Scope'}
                          </span>
                          {org && (
                            <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              {org.code}
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => {
                                setBldOrgId(orgId || '');
                                setSubTab('buildings');
                                setIsAdding(true);
                              }}
                              className="px-2.5 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
                            >
                              <Plus className="w-3 h-3" /> Add Building
                            </button>
                          </div>
                        </div>

                        {/* Buildings list */}
                        <div className="p-4 flex flex-col gap-3">
                          {orgBuildings.map(bld => {
                            const isBldExpanded = expandedBlds[bld.id] !== false;
                            const bldFloors = floors.filter(f => f.buildingId === bld.id);
                            
                            return (
                              <div key={bld.id} className="border border-gray-200/60 rounded-xl bg-white overflow-hidden shadow-2xs">
                                {/* Building Header Row */}
                                <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50/40 border-b border-gray-100">
                                  <button
                                    onClick={() => toggleBldExpanded(bld.id)}
                                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
                                  >
                                    {isBldExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                  
                                  {editingBldId === bld.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        type="text"
                                        value={editingBldName}
                                        onChange={e => setEditingBldName(e.target.value)}
                                        className="text-xs bg-white border border-[#E9E5DE] px-2.5 py-1 rounded-md font-bold text-[#1F2937] flex-1"
                                        placeholder="Building Name"
                                      />
                                      <input
                                        type="text"
                                        value={editingBldAddress}
                                        onChange={e => setEditingBldAddress(e.target.value)}
                                        className="text-[11px] bg-white border border-[#E9E5DE] px-2.5 py-1 rounded-md text-gray-600 w-1/3"
                                        placeholder="Address"
                                      />
                                      <button
                                        onClick={() => handleSaveBuildingEdit(bld.id)}
                                        className="p-1 bg-[#2E7D32] text-white rounded-md hover:bg-[#1B5E20]"
                                        title="Save"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingBldId(null)}
                                        className="p-1 bg-gray-150 text-gray-600 rounded-md hover:bg-gray-200"
                                        title="Cancel"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-extrabold text-sm text-[#1F2937] truncate">{bld.name}</span>
                                        {bld.address && (
                                          <span className="text-[10px] text-gray-500 font-medium truncate flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-gray-400" /> {bld.address}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {editingBldId !== bld.id && (
                                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingBldId(bld.id);
                                          setEditingBldName(bld.name);
                                          setEditingBldAddress(bld.address || '');
                                        }}
                                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                                        title="Rename Building"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setFlrBldId(bld.id);
                                          setSubTab('floors');
                                          setIsAdding(true);
                                        }}
                                        className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
                                        title="Add Floor Layer"
                                      >
                                        <Plus className="w-3 h-3 text-gray-500" /> Floor
                                      </button>
                                      <button
                                        onClick={() => onDeleteBuilding(bld.id)}
                                        className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                        title="Delete Building"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Building Floors Section */}
                                {isBldExpanded && (
                                  <div className="px-4 py-2 bg-white flex flex-col gap-2">
                                    {bldFloors.length === 0 ? (
                                      <div className="py-4 text-center text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                        No floors added yet. Click "+ Floor" to start mapping.
                                      </div>
                                    ) : (
                                      bldFloors.map(flr => {
                                        const isFlrExpanded = expandedFlrs[flr.id] !== false;
                                        const flrRooms = rooms.filter(r => r.floorId === flr.id);
                                        
                                        return (
                                          <div key={flr.id} className="border border-gray-150 rounded-lg overflow-hidden ml-4">
                                            {/* Floor Header Row */}
                                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50 border-b border-gray-100">
                                              <button
                                                onClick={() => toggleFlrExpanded(flr.id)}
                                                className="p-1 hover:bg-gray-100 rounded-md text-gray-500"
                                              >
                                                {isFlrExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                              </button>

                                              {editingFlrId === flr.id ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                  <input
                                                    type="text"
                                                    value={editingFlrName}
                                                    onChange={e => setEditingFlrName(e.target.value)}
                                                    className="text-xs bg-white border border-[#E9E5DE] px-2 py-0.5 rounded font-bold text-[#1F2937] flex-1"
                                                    placeholder="Floor Name"
                                                  />
                                                  <input
                                                    type="number"
                                                    value={editingFlrLevel}
                                                    onChange={e => setEditingFlrLevel(parseInt(e.target.value, 10) || 0)}
                                                    className="text-xs bg-white border border-[#E9E5DE] px-2 py-0.5 rounded font-bold text-[#1F2937] w-16"
                                                    placeholder="Level"
                                                  />
                                                  <button
                                                    onClick={() => handleSaveFloorEdit(flr.id)}
                                                    className="p-0.5 bg-[#2E7D32] text-white rounded hover:bg-[#1B5E20]"
                                                  >
                                                    <Check className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    onClick={() => setEditingFlrId(null)}
                                                    className="p-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                  <Layers className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                  <span className="font-bold text-xs text-gray-800">{flr.name}</span>
                                                  <span className="bg-[#E2F1E8] text-[#1B5E20] px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                                                    Lvl {flr.level}
                                                  </span>
                                                </div>
                                              )}

                                              {editingFlrId !== flr.id && (
                                                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                  <button
                                                    onClick={() => {
                                                      setEditingFlrId(flr.id);
                                                      setEditingFlrName(flr.name);
                                                      setEditingFlrLevel(flr.level);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-all"
                                                    title="Edit Floor Level"
                                                  >
                                                    <Edit2 className="w-3 h-3" />
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setRmBldId(bld.id);
                                                      setRmFlrId(flr.id);
                                                      setSubTab('rooms');
                                                      setIsAdding(true);
                                                    }}
                                                    className="px-2 py-0.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-[9px] font-bold rounded flex items-center gap-0.5 transition-all"
                                                    title="Add Inspection Room"
                                                  >
                                                    <Plus className="w-2.5 h-2.5 text-gray-500" /> Room
                                                  </button>
                                                  <button
                                                    onClick={() => onDeleteFloor(flr.id)}
                                                    className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                                                    title="Delete Floor"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>

                                            {/* Floor Rooms list */}
                                            {isFlrExpanded && (
                                              <div className="px-3 py-1.5 bg-gray-50/25 flex flex-col gap-1 ml-3 border-l-2 border-gray-150">
                                                {flrRooms.length === 0 ? (
                                                  <div className="py-2 text-center text-[10px] text-gray-400 font-medium">
                                                    No rooms on this floor yet.
                                                  </div>
                                                ) : (
                                                  flrRooms.map(rm => (
                                                    <div key={rm.id} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all text-xs">
                                                      
                                                      {editingRmId === rm.id ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                          <input
                                                            type="text"
                                                            value={editingRmName}
                                                            onChange={e => setEditingRmName(e.target.value)}
                                                            className="text-xs bg-white border border-[#E9E5DE] px-2 py-0.5 rounded font-bold text-[#1F2937] flex-1"
                                                          />
                                                          <select
                                                            value={editingRmType}
                                                            onChange={e => setEditingRmType(e.target.value)}
                                                            className="text-xs bg-white border border-[#E9E5DE] px-1 py-0.5 rounded font-semibold text-gray-700"
                                                          >
                                                            <option value="Restroom">Restroom</option>
                                                            <option value="Patient Room">Patient Room</option>
                                                            <option value="OR Suite">OR Suite</option>
                                                            <option value="ICU Bed">ICU Bed</option>
                                                            <option value="Classroom">Classroom</option>
                                                            <option value="Lab Space">Lab Space</option>
                                                            <option value="Office">Office</option>
                                                            <option value="Hallway">Hallway</option>
                                                            <option value="Lobby">Lobby</option>
                                                          </select>
                                                          <button
                                                            onClick={() => handleSaveRoomEdit(rm.id)}
                                                            className="p-0.5 bg-[#2E7D32] text-white rounded hover:bg-[#1B5E20]"
                                                          >
                                                            <Check className="w-3 h-3" />
                                                          </button>
                                                          <button
                                                            onClick={() => setEditingRmId(null)}
                                                            className="p-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                          >
                                                            <X className="w-3 h-3" />
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <div className="flex items-center gap-2 min-w-0">
                                                            <FolderTree className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                            <span className="font-bold text-gray-800 truncate">{rm.name}</span>
                                                            <span className="inline-flex items-center bg-gray-100 border border-gray-200 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                              {rm.type}
                                                            </span>
                                                          </div>

                                                          <div className="flex items-center gap-3 shrink-0 ml-4">
                                                            <div className="flex items-center gap-1 font-mono text-[9px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                                              <QrCode className="w-3 h-3 text-[#2E7D32]" />
                                                              <span className="font-bold text-gray-700">{rm.qrToken}</span>
                                                            </div>

                                                            <div className="flex items-center gap-1">
                                                              <button
                                                                onClick={() => {
                                                                  setEditingRmId(rm.id);
                                                                  setEditingRmName(rm.name);
                                                                  setEditingRmType(rm.type);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white rounded transition-all"
                                                                title="Rename Room"
                                                              >
                                                                <Edit2 className="w-3 h-3" />
                                                              </button>
                                                              <button
                                                                onClick={() => onDeleteRoom(rm.id)}
                                                                className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                                                                title="Delete Room"
                                                              >
                                                                <Trash2 className="w-3 h-3" />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        </>
                                                      )}
                                                    </div>
                                                  ))
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab !== 'explorer' && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl shadow-xs overflow-hidden">
        
        {/* Buildings Table */}
        {subTab === 'buildings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Building Name</th>
                  <th className="py-3.5 px-6">Parent Client Organization</th>
                  <th className="py-3.5 px-6">Physical Address Location</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {buildings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      No building master data registered yet.
                    </td>
                  </tr>
                ) : (
                  buildings.map(bld => {
                    const org = organizations.find(o => o.id === bld.organizationId);
                    return (
                      <tr key={bld.id} className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="py-4 px-6 font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {bld.name}
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-semibold text-gray-700">{org ? org.name : 'System-Wide'}</span>
                          <span className="ml-2 bg-[#FAFAF8] text-gray-500 px-1.5 py-0.5 rounded text-[9px] font-bold border border-gray-100">{org ? org.code : 'SYS'}</span>
                        </td>
                        <td className="py-4 px-6 text-gray-400 font-medium">
                          {bld.address || 'No geographical location registered.'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => onDeleteBuilding(bld.id)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Building"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Floors Table */}
        {subTab === 'floors' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Floor Level Display Name</th>
                  <th className="py-3.5 px-6">Numeric Level Value</th>
                  <th className="py-3.5 px-6">Belongs to Building</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {floors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      No floor layers registered yet.
                    </td>
                  </tr>
                ) : (
                  floors.map(flr => {
                    const bld = buildings.find(b => b.id === flr.buildingId);
                    return (
                      <tr key={flr.id} className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="py-4 px-6 font-extrabold text-[#1F2937] flex items-center gap-2">
                          <Layers className="w-4 h-4 text-gray-400" />
                          {flr.name}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-[#2E7D32]">
                          Level {flr.level}
                        </td>
                        <td className="py-4 px-6 text-gray-500 font-medium">
                          {bld ? bld.name : 'Disconnected Building'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => onDeleteFloor(flr.id)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Floor Layer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Rooms Table */}
        {subTab === 'rooms' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Room Name</th>
                  <th className="py-3.5 px-6">Type Category</th>
                  <th className="py-3.5 px-6">Location Hierarchy</th>
                  <th className="py-3.5 px-6">QR Assignment Code</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      No rooms registered. Please create one to generate secure token badges.
                    </td>
                  </tr>
                ) : (
                  rooms.map(rm => {
                    const bld = buildings.find(b => b.id === rm.buildingId);
                    const flr = floors.find(f => f.id === rm.floorId);
                    return (
                      <tr key={rm.id} className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="py-4 px-6 font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-gray-400" />
                          {rm.name}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 bg-[#F5F5F5] border border-gray-200 text-gray-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {rm.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-400 font-semibold">
                          {bld ? bld.name : 'Unknown Building'} • {flr ? flr.name : 'Unknown Floor'}
                        </td>
                        <td className="py-4 px-6 font-mono text-[10px] text-gray-500 flex items-center gap-1.5 mt-1">
                          <QrCode className="w-3.5 h-3.5 text-[#2E7D32]" />
                          <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100 font-bold">{rm.qrToken}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => onDeleteRoom(rm.id)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Room & QR Linkage"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
      )}

    </div>
  );
}
