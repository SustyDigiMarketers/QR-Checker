import React, { useState } from 'react';
import { Calendar, User, Layers, Trash2, Plus, Sparkles, FolderTree, Clock, CheckCircle } from 'lucide-react';
import { Assignment, User as UserType, Room, Building, Floor } from '../types';

interface AssignmentsTabProps {
  assignments: Assignment[];
  users: UserType[];
  rooms: Room[];
  buildings: Building[];
  floors: Floor[];
  onAddAssignment: (assignment: Omit<Assignment, 'id' | 'createdAt' | 'inspectorName'> & { inspectorId: string }) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  isProcessing: boolean;
}

export default function AssignmentsTab({
  assignments,
  users,
  rooms,
  buildings,
  floors,
  onAddAssignment,
  onDeleteAssignment,
  isProcessing
}: AssignmentsTabProps) {
  const [selectedInspectorId, setSelectedInspectorId] = useState('');
  const [selectedShift, setSelectedShift] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter inspectors
  const inspectors = users.filter(u => u.role === 'Inspector');

  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId) 
        : [...prev, roomId]
    );
  };

  const handleSelectAllRooms = () => {
    if (selectedRoomIds.length === rooms.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(rooms.map(r => r.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedInspectorId) {
      setError('Please select an inspector.');
      return;
    }
    if (selectedRoomIds.length === 0) {
      setError('Please assign at least one room.');
      return;
    }

    try {
      await onAddAssignment({
        inspectorId: selectedInspectorId,
        roomIds: selectedRoomIds,
        shift: selectedShift,
        date: selectedDate
      });
      // Reset form on success
      setSelectedInspectorId('');
      setSelectedRoomIds([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment');
    }
  };

  // Helper helper to resolve names
  const getRoomName = (id: string) => {
    const room = rooms.find(r => r.id === id);
    if (!room) return 'Unknown Room';
    const building = buildings.find(b => b.id === room.buildingId);
    return `${room.name} (${building ? building.name : 'Unknown'})`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in" id="assignments-tab-root">
      
      {/* LEFT 1 COLUMN: ASSIGNMENT CREATOR FORM */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6 shadow-xs" id="create-assignment-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[#2E7D32]/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wider">New Shift Assignment</h3>
              <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Allocate rooms & shifts daily</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl" id="assignment-error-alert">
                {error}
              </div>
            )}

            {/* Select Inspector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Inspector</label>
              <div className="relative">
                <select
                  value={selectedInspectorId}
                  onChange={e => setSelectedInspectorId(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E9E5DE] text-xs font-bold rounded-xl py-2.5 pl-3 pr-10 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-gray-700"
                  id="select-inspector-dropdown"
                >
                  <option value="">-- Choose Inspector --</option>
                  {inspectors.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Select Shift */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Shift</label>
              <div className="grid grid-cols-3 gap-2" id="shift-selector-group">
                {(['Morning', 'Afternoon', 'Night'] as const).map(sh => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => setSelectedShift(sh)}
                    className={`py-2 rounded-xl text-center text-[10px] font-bold border transition-all ${
                      selectedShift === sh
                        ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-xs'
                        : 'bg-[#FAFAF8] border-[#E9E5DE] text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {sh}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-gray-400 font-medium italic mt-0.5">
                {selectedShift === 'Morning' && 'Morning Shift: 06:00 AM – 02:00 PM'}
                {selectedShift === 'Afternoon' && 'Afternoon Shift: 02:00 PM – 10:00 PM'}
                {selectedShift === 'Night' && 'Night Shift: 10:00 PM – 06:00 AM'}
              </p>
            </div>

            {/* Select Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheduled Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E9E5DE] text-xs font-bold rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] text-gray-700"
                  id="select-date-input"
                />
              </div>
            </div>

            {/* Select Rooms */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Rooms ({selectedRoomIds.length})</label>
                <button
                  type="button"
                  onClick={handleSelectAllRooms}
                  className="text-[9px] text-[#2E7D32] font-bold hover:underline"
                >
                  {selectedRoomIds.length === rooms.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="border border-[#E9E5DE] rounded-xl bg-[#FAFAF8] p-3 max-h-56 overflow-y-auto flex flex-col gap-1.5" id="rooms-checklist">
                {rooms.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic text-center py-4">No rooms available. Create rooms first.</p>
                ) : (
                  rooms.map(room => {
                    const bld = buildings.find(b => b.id === room.buildingId);
                    const flr = floors.find(f => f.id === room.floorId);
                    return (
                      <label
                        key={room.id}
                        className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#E9E5DE] hover:border-gray-300 cursor-pointer select-none transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoomIds.includes(room.id)}
                          onChange={() => handleToggleRoom(room.id)}
                          className="w-3.5 h-3.5 text-[#2E7D32] border-[#E9E5DE] rounded focus:ring-0 focus:ring-offset-0 focus:outline-none"
                        />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-gray-700 truncate">{room.name}</p>
                          <p className="text-[8px] text-gray-400 font-semibold uppercase mt-0.5">
                            {bld ? bld.name : 'Unknown Building'} &bull; {flr ? flr.name : 'Unknown Floor'}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md shadow-[#2E7D32]/10 transition-all flex items-center justify-center gap-2 mt-2 group"
              id="submit-assignment-btn"
            >
              <CheckCircle className="w-4 h-4 text-green-200 group-hover:scale-110 transition-transform" />
              <span>{isProcessing ? 'Saving Assignment...' : 'Issue Assignment'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT 2 COLUMNS: CURRENT ASSIGNMENTS VIEW */}
      <div className="xl:col-span-2 flex flex-col gap-6">
        <div className="bg-white border border-[#E9E5DE] rounded-3xl p-6 shadow-xs flex-1" id="assignments-list-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wider">Shift Assignment Grid</h3>
                <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Currently issued schedules ({assignments.length})</p>
              </div>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" id="empty-assignments-state">
              <FolderTree className="w-12 h-12 text-gray-300 mb-3 animate-pulse" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No Shifts Scheduled</p>
              <p className="text-[10px] text-gray-400 max-w-xs mt-1">Use the scheduler form on the left to assign physical rooms to an inspector for today's shifts.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4" id="assignments-list">
              {assignments.map(asg => (
                <div
                  key={asg.id}
                  className="bg-[#FAFAF8] border border-[#E9E5DE] rounded-2xl p-5 hover:border-gray-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border border-blue-150">
                        {asg.shift} Shift
                      </span>
                      <span className="bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border border-green-150">
                        {asg.date}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        Issued: {new Date(asg.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{asg.inspectorName}</span>
                    </h4>

                    {/* Room list badge container */}
                    <div className="mt-3 flex flex-col gap-1.5">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Assigned Rooms ({asg.roomIds.length}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {asg.roomIds.map(rid => (
                          <span
                            key={rid}
                            className="bg-white border border-[#E9E5DE] text-[10px] text-gray-600 font-bold px-2 py-1 rounded-lg shadow-2xs"
                          >
                            {getRoomName(rid)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteAssignment(asg.id)}
                    disabled={isProcessing}
                    className="p-2.5 bg-white border border-[#E9E5DE] hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-xl text-gray-400 transition-all self-end sm:self-center"
                    title="Remove assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
