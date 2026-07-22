import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  ClipboardCheck, 
  Star,
  Plus,
  X,
  Check,
  Edit2,
  Trash2,
  Key,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { User, Inspection } from '../types';

interface InspectorsTabProps {
  inspectors: User[];
  inspections: Inspection[];
  onAddUser: (user: { username: string; email: string; fullName: string; role: 'Organization Admin' | 'Inspector'; organizationId?: string; password?: string }) => Promise<void>;
  onUpdateUser: (id: string, updates: Partial<User> & { password?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  isProcessing: boolean;
  currentUserRole?: string;
}

export default function InspectorsTab({ 
  inspectors, 
  inspections,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  isProcessing,
  currentUserRole
}: InspectorsTabProps) {
  
  // Registration form states
  const [isAdding, setIsAdding] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Organization Admin' | 'Inspector'>('Inspector');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline editing states on cards
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Submit new Inspector registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setFormError('All fields marked with * are required.');
      return;
    }

    const sanitizedUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    
    try {
      await onAddUser({
        fullName: fullName.trim(),
        username: sanitizedUsername,
        email: email.trim(),
        role,
        password: password ? password : undefined
      });

      // Reset form on success
      setIsAdding(false);
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('Inspector');
    } catch (err: any) {
      setFormError(err.message || 'Failed to register new inspector.');
    }
  };

  // Start editing inspector profile inline
  const handleStartEdit = (inspector: User) => {
    setEditingId(inspector.id);
    setEditFullName(inspector.fullName);
    setEditUsername(inspector.username);
    setEditEmail(inspector.email);
  };

  // Save inline edits
  const handleSaveEdit = async (id: string) => {
    if (!editFullName.trim() || !editUsername.trim() || !editEmail.trim()) {
      alert('All fields are required.');
      return;
    }
    
    try {
      await onUpdateUser(id, {
        fullName: editFullName.trim(),
        username: editUsername.trim().toLowerCase().replace(/\s+/g, ''),
        email: editEmail.trim()
      });
      setEditingId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save changes.');
    }
  };

  // Reset Inspector Password
  const handleResetPassword = async (inspector: User) => {
    const newPass = window.prompt(`Type a new secure password for ${inspector.fullName}:`);
    if (newPass === null) return;
    
    if (newPass.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    try {
      await onUpdateUser(inspector.id, { password: newPass });
      alert(`Password credentials for @${inspector.username} reset successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="inspectors-tab-panel">
      
      {/* Header with quick registration toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2E7D32]" />
            {currentUserRole === 'Organization Admin' ? 'Organization Staff' : 'Organization Inspectors'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {currentUserRole === 'Organization Admin' 
              ? 'Monitor your active field compliance inspectors and managers, register new profiles, configure credentials, and evaluate rating scores.'
              : 'Monitor your active field compliance inspectors, register new profiles, configure credentials, and evaluate rating scores.'}
          </p>
        </div>

        <button
          onClick={() => { setIsAdding(!isAdding); setFormError(null); }}
          className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
          id="toggle-register-inspector-btn"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isAdding ? 'Cancel' : (currentUserRole === 'Organization Admin' ? 'Register New Staff' : 'Register New Inspector')}</span>
        </button>
      </div>

      {/* Slide-down form for creating new Inspector */}
      {isAdding && (
        <div className="bg-white border border-[#E9E5DE] rounded-2xl p-6 shadow-xs animate-fade-in" id="register-inspector-form">
          <h3 className="font-bold text-sm text-[#1F2937] uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
            {currentUserRole === 'Organization Admin' ? 'Staff Account Setup' : 'Field Inspector Account Setup'}
          </h3>

          {formError && (
            <div className="mb-4 bg-red-50 border border-red-150 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Full Representative Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Robert Downey"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                id="new-inspector-fullname"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Login Username * (No spaces)</label>
              <input
                required
                type="text"
                placeholder="e.g. robert.insp"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-bold text-[#1F2937] lowercase"
                id="new-inspector-username"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Official Email Address *</label>
              <input
                required
                type="email"
                placeholder="e.g. robert@apex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                id="new-inspector-email"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">Security Password Credentials (Optional)</label>
              <input
                type="text"
                placeholder="Leave blank to let system auto-generate"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                id="new-inspector-password"
              />
            </div>

            {currentUserRole === 'Organization Admin' && (
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">System Staff Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-semibold text-[#1F2937]"
                >
                  <option value="Inspector">Inspector (Field Auditor)</option>
                  <option value="Organization Admin">Manager (Organization Administrator)</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md"
                id="submit-register-inspector-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Registering Staff Member...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{currentUserRole === 'Organization Admin' ? 'Register Staff Account' : 'Register Inspector Account'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of inspector cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inspectors.length === 0 ? (
          <div className="col-span-full bg-white border border-dashed border-[#E9E5DE] rounded-2xl p-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto text-gray-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold text-xs uppercase tracking-wide">No Inspectors Registered</p>
            <p className="text-[10px] mt-1">Setup and assign inspectors to manage facility compliance scan routines.</p>
          </div>
        ) : (
          inspectors.map(inspector => {
            // Calculate performance metrics
            const inspectorInspections = inspections.filter(i => i.inspectorId === inspector.id);
            const totalAudits = inspectorInspections.length;
            
            // Average Rating
            const ratedInspections = inspectorInspections.filter(i => i.rating > 0);
            const avgRating = ratedInspections.length > 0
              ? Number((ratedInspections.reduce((sum, i) => sum + i.rating, 0) / ratedInspections.length).toFixed(1))
              : 5.0;

            // Compliance rate (cleaned true / total)
            const cleanInspections = inspectorInspections.filter(i => i.cleaned).length;
            const complianceRate = totalAudits > 0
              ? Math.round((cleanInspections / totalAudits) * 100)
              : 100;

            const isEditing = editingId === inspector.id;

            return (
              <div 
                key={inspector.id} 
                className="bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-5 hover:shadow-md transition-shadow duration-200"
                id={`inspector-card-${inspector.id}`}
              >
                {isEditing ? (
                  /* CARD EDITING VIEW */
                  <div className="flex flex-col gap-3">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Modify Profile</h4>
                    
                    <div>
                      <label className="block text-[8px] font-extrabold text-gray-400 uppercase mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={e => setEditFullName(e.target.value)}
                        className="w-full text-xs border border-gray-200 bg-[#FAFAF8] rounded-lg p-2 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-extrabold text-gray-400 uppercase mb-1">Username</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={e => setEditUsername(e.target.value)}
                        className="w-full text-xs border border-gray-200 bg-[#FAFAF8] rounded-lg p-2 focus:outline-none lowercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-extrabold text-gray-400 uppercase mb-1">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="w-full text-xs border border-gray-200 bg-[#FAFAF8] rounded-lg p-2 focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-1.5 mt-2">
                      <button
                        onClick={() => handleSaveEdit(inspector.id)}
                        className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg"
                        title="Save Changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CARD STANDBY VIEW */
                  <>
                    {/* Profile Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img 
                          src={inspector.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop"} 
                          alt={inspector.fullName}
                          className="w-12 h-12 rounded-full border border-gray-100 object-cover shrink-0"
                        />
                        <div className="overflow-hidden">
                          <h3 className="font-extrabold text-sm text-[#1F2937] truncate">{inspector.fullName}</h3>
                          <p className="text-[10px] text-gray-400 font-bold font-mono mt-0.5">@{inspector.username}</p>
                          <p className="text-[9px] text-gray-500 font-medium truncate mt-0.5">{inspector.email}</p>
                        </div>
                      </div>

                      {/* Side Actions Drawer */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(inspector)}
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-50 border border-transparent hover:border-gray-100 rounded transition-all"
                          title="Edit Profile Parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(inspector)}
                          className="p-1 text-gray-400 hover:text-[#C8A165] hover:bg-amber-50/50 border border-transparent hover:border-amber-100 rounded transition-all"
                          title="Reset Password Credentials"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Permanently remove ${inspector.fullName} from registry?`)) {
                              onDeleteUser(inspector.id);
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 rounded transition-all"
                          title="Purge Inspector Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="grid grid-cols-3 gap-2 bg-[#FAFAF8] border border-gray-100 rounded-xl p-3">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-400 uppercase font-extrabold">Total Audits</p>
                        <p className="text-sm font-extrabold text-[#1F2937] mt-1">{totalAudits}</p>
                      </div>
                      <div className="text-center border-x border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase font-extrabold">Avg Rating</p>
                        <p className="text-sm font-extrabold text-amber-500 mt-1 flex items-center justify-center gap-0.5">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {avgRating}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-400 uppercase font-extrabold">Compliance</p>
                        <p className="text-sm font-extrabold text-[#2E7D32] mt-1">{complianceRate}%</p>
                      </div>
                    </div>

                    {/* Footer status & details */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                      <button
                        onClick={() => onUpdateUser(inspector.id, { active: !inspector.active })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-full transition-all text-[9px] font-extrabold uppercase ${
                          inspector.active 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        }`}
                        title="Toggle shift duty status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${inspector.active ? 'bg-green-500' : 'bg-red-400'}`} />
                        <span>{inspector.active ? 'On Shift' : 'Off-Duty'}</span>
                      </button>

                      <span className="text-[9px] bg-[#E8F5E9] text-[#2E7D32] border border-green-200 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
                        {inspector.role === 'Organization Admin' ? 'Manager' : 'Inspector'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
