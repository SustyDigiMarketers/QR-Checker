import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Trash2, 
  Star, 
  Download, 
  Filter, 
  SlidersHorizontal,
  ChevronDown,
  Building,
  Image,
  Layers,
  MapPin,
  RefreshCw,
  X
} from 'lucide-react';
import { Inspection, Building as BuildingType, Floor as FloorType, Organization } from '../types';

interface InspectionsTabProps {
  inspections: Inspection[];
  buildings: BuildingType[];
  floors: FloorType[];
  organizations: Organization[];
  onDeleteInspection: (id: string) => Promise<void>;
  onVerifyInspection?: (id: string, status: 'Verified' | 'Rejected', remarks: string) => Promise<void>;
  currentUserRole: string;
}

export default function InspectionsTab({
  inspections,
  buildings,
  floors,
  organizations,
  onDeleteInspection,
  onVerifyInspection,
  currentUserRole
}: InspectionsTabProps) {

  // Query state parameters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCleaned, setFilterCleaned] = useState<string>('all'); // 'all' | 'cleaned' | 'dirty'
  const [filterRating, setFilterRating] = useState<string>('all'); // 'all' | '5' | '4' | '3' | 'under3'
  const [filterBuilding, setFilterBuilding] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'Submitted' | 'Verified' | 'Rejected'
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Modal display for viewing evidence photos
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Supervisor verification comment buffer state
  const [reviewRemarks, setReviewRemarks] = useState<{ [inspectionId: string]: string }>({});

  // Filter application
  const filteredInspections = inspections.filter(ins => {
    // 0. Status match
    const insStatus = ins.status || 'Submitted';
    const matchesStatus = filterStatus === 'all' || insStatus === filterStatus;
    // 1. Search term match
    const matchesSearch = 
      ins.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ins.inspectorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ins.remarks.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Clean status match
    const matchesClean = 
      filterCleaned === 'all' || 
      (filterCleaned === 'cleaned' && ins.cleaned) ||
      (filterCleaned === 'dirty' && !ins.cleaned);

    // 3. Rating score match
    let matchesRating = true;
    if (filterRating !== 'all') {
      if (filterRating === 'under3') {
        matchesRating = ins.rating < 3;
      } else {
        matchesRating = ins.rating === parseInt(filterRating, 10);
      }
    }

    // 4. Building match
    const matchesBuilding = filterBuilding === 'all' || ins.buildingName === filterBuilding;

    return matchesStatus && matchesSearch && matchesClean && matchesRating && matchesBuilding;
  });

  // Sorting application
  const sortedInspections = [...filteredInspections].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortOrder === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOrder === 'highest') {
      return b.rating - a.rating;
    }
    if (sortOrder === 'lowest') {
      return a.rating - b.rating;
    }
    return 0;
  });

  // Export results helper (trigger CSV Download)
  const handleExportCSV = () => {
    const headers = [
      'ID', 'Room Name', 'Building', 'Floor', 'Organization', 
      'Inspector', 'Status', 'Rating', 'Remarks', 'Device Time', 'Synced To Sheet'
    ];
    
    const rows = sortedInspections.map(i => [
      i.id,
      `"${i.roomName.replace(/"/g, '""')}"`,
      `"${i.buildingName.replace(/"/g, '""')}"`,
      `"${i.floorName.replace(/"/g, '""')}"`,
      `"${i.organizationName.replace(/"/g, '""')}"`,
      `"${i.inspectorName.replace(/"/g, '""')}"`,
      i.cleaned ? 'Cleaned' : 'Dirty',
      i.rating,
      `"${i.remarks.replace(/"/g, '""')}"`,
      i.createdAt,
      i.syncedToGoogleSheets ? 'Yes' : 'No'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cleancheck_inspections_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in" id="inspections-tab-panel">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#2E7D32]" />
            Compliance Inspection Registry
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Browse fully-denormalized operational history, trace cleaner performance, inspect evidence snapshots, and export spreadsheet files.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={sortedInspections.length === 0}
          className="px-4 py-2.5 bg-white border border-[#E9E5DE] text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-2xs"
          id="export-inspections-csv-btn"
        >
          <Download className="w-4 h-4 text-gray-500" />
          <span>Export filtered CSV ({sortedInspections.length})</span>
        </button>
      </div>

      {/* Grid: Filters Box */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
        
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E9E5DE] rounded-xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search log history by room name, inspector identity, or remarks text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs outline-none text-[#1F2937] placeholder-gray-400 font-semibold"
          />
        </div>

        {/* Dynamic Filters Dropdowns Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Filter Status */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Compliance Status</label>
            <select
              value={filterCleaned}
              onChange={(e) => setFilterCleaned(e.target.value)}
              className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
            >
              <option value="all">All States</option>
              <option value="cleaned">Cleaned / Compliant</option>
              <option value="dirty">Dirty / Alert State</option>
            </select>
          </div>

          {/* Filter Ratings star */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Cleanliness Score</label>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
            >
              <option value="all">All Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
              <option value="4">⭐⭐⭐⭐ 4 Stars</option>
              <option value="3">⭐⭐⭐ 3 Stars</option>
              <option value="under3">⚠️ Under 3 Stars</option>
            </select>
          </div>

          {/* Filter Buildings */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Building Location</label>
            <select
              value={filterBuilding}
              onChange={(e) => setFilterBuilding(e.target.value)}
              className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
            >
              <option value="all">All Buildings</option>
              {Array.from(new Set(inspections.map(i => i.buildingName))).map(bldName => (
                <option key={bldName} value={bldName}>{bldName}</option>
              ))}
            </select>
          </div>

          {/* Filter Supervisor Review */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Supervisor Review</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
            >
              <option value="all">All Reviews</option>
              <option value="Submitted">Pending Review</option>
              <option value="Verified">Verified Approved</option>
              <option value="Rejected">Flagged Rejected</option>
            </select>
          </div>

          {/* Sorter Order */}
          <div>
            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">Sort Distribution</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full text-xs bg-[#FAFAF8] border border-[#E9E5DE] p-2.5 rounded-xl focus:outline-none font-semibold text-[#1F2937]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
          </div>

        </div>

      </div>

      {/* Primary Registry Table Grid Card */}
      <div className="bg-white border border-[#E9E5DE] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="inspections-registry-table">
            <thead>
              <tr className="border-b border-[#E9E5DE] bg-gray-50/50 text-gray-400 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="py-4 px-6">Verified Facility Room</th>
                <th className="py-4 px-6">Hierarchy Level</th>
                <th className="py-4 px-6 text-center">Score</th>
                <th className="py-4 px-6">Inspector Assigned</th>
                <th className="py-4 px-6">Evidence Check</th>
                <th className="py-4 px-6">Supervisor Verification</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {sortedInspections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                    No historical logs matched the selected filters.
                  </td>
                </tr>
              ) : (
                sortedInspections.map((ins) => (
                  <tr key={ins.id} className="hover:bg-[#FAFAF8] transition-colors">
                    
                    {/* Room Name & Date */}
                    <td className="py-4 px-6">
                      <p className="font-extrabold text-sm text-[#1F2937]">{ins.roomName}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        Audit Date: {new Date(ins.createdAt).toLocaleDateString()} at {new Date(ins.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* Building Hierarchy */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-gray-500 font-bold">
                        <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{ins.buildingName}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium ml-5 mt-0.5">{ins.floorName}</p>
                    </td>

                    {/* Star Rating Score & remarks summary */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1 font-extrabold">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                          ins.cleaned 
                            ? 'bg-green-50 text-[#2E7D32] border border-green-100' 
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          <Star className="w-3.5 h-3.5 fill-current text-[#C8A165]" />
                          {ins.rating}
                        </span>
                      </div>
                    </td>

                    {/* Inspector Name */}
                    <td className="py-4 px-6">
                      <p className="font-bold text-gray-800">{ins.inspectorName}</p>
                      <p className="text-[9px] font-mono text-gray-400 mt-0.5">ID: {ins.inspectorId}</p>
                    </td>

                    {/* Remarks & Photos */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1 max-w-xs">
                        <p className="italic text-gray-500 font-medium truncate" title={ins.remarks}>
                          "{ins.remarks || 'No observation remarks recorded.'}"
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {ins.photoUrl && (
                            <button
                              onClick={() => setActivePhotoUrl(ins.photoUrl!)}
                              className="text-[10px] text-[#2E7D32] font-bold hover:underline flex items-center gap-1 bg-[#E8F5E9] px-2 py-0.5 rounded-md border border-green-100"
                            >
                              <Image className="w-3.5 h-3.5" />
                              Evidence Photo
                            </button>
                          )}
                          {ins.signatureUrl && (
                            <button
                              onClick={() => setActivePhotoUrl(ins.signatureUrl!)}
                              className="text-[10px] text-[#C8A165] font-bold hover:underline flex items-center gap-1 bg-[#FFF8E1] px-2 py-0.5 rounded-md border border-[#FFE082]"
                            >
                              ✍️ Signature
                            </button>
                          )}
                          {(ins.latitude !== undefined && ins.longitude !== undefined) && (
                            <span 
                              className="text-[9px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md font-mono flex items-center gap-0.5"
                              title={`Verified GPS coordinates: ${ins.latitude}, ${ins.longitude}`}
                            >
                              📍 {ins.latitude.toFixed(4)}, {ins.longitude.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Supervisor Verification Status Column */}
                    <td className="py-4 px-6 min-w-[200px]">
                      {(() => {
                        const currentStatus = ins.status || 'Submitted';
                        if (currentStatus === 'Verified') {
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 bg-[#E8F5E9] text-[#2E7D32] text-[9px] font-extrabold px-2 py-0.5 rounded border border-green-200 uppercase tracking-wide w-max">
                                Verified Approved ✅
                              </span>
                              {ins.supervisorRemarks && (
                                <p className="text-[10px] text-gray-500 italic font-medium">
                                  "{ins.supervisorRemarks}"
                                </p>
                              )}
                              {ins.verifiedAt && (
                                <p className="text-[9px] text-gray-400 font-medium">
                                  on {new Date(ins.verifiedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          );
                        }

                        if (currentStatus === 'Rejected') {
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wide w-max">
                                Flagged Rejected ⚠️
                              </span>
                              {ins.supervisorRemarks && (
                                <p className="text-[10px] text-red-600 italic font-medium">
                                  "{ins.supervisorRemarks}"
                                </p>
                              )}
                              {ins.verifiedAt && (
                                <p className="text-[9px] text-gray-400 font-medium">
                                  on {new Date(ins.verifiedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          );
                        }

                        // Status is 'Submitted' / 'Pending'
                        const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Organization Admin';
                        if (!isAdmin) {
                          return (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[9px] font-extrabold px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wide">
                              Pending Supervisor Review
                            </span>
                          );
                        }

                        return (
                          <div className="flex flex-col gap-2 max-w-[240px]">
                            <input
                              type="text"
                              placeholder="Add supervisor note (optional)..."
                              value={reviewRemarks[ins.id] || ''}
                              onChange={(e) => setReviewRemarks(prev => ({ ...prev, [ins.id]: e.target.value }))}
                              className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onVerifyInspection?.(ins.id, 'Verified', reviewRemarks[ins.id] || '')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-extrabold py-1 px-2 rounded-md uppercase tracking-wide transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onVerifyInspection?.(ins.id, 'Rejected', reviewRemarks[ins.id] || '')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-extrabold py-1 px-2 rounded-md uppercase tracking-wide transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </td>



                    {/* Super admin Deletions */}
                    <td className="py-4 px-6 text-right">
                      {(currentUserRole === 'Super Admin' || currentUserRole === 'Organization Admin') ? (
                        <button
                          onClick={() => onDeleteInspection(ins.id)}
                          className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          title="Purge log row"
                          id={`delete-inspection-${ins.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Locked</span>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Snapshot Lightbox Dialog Modal */}
      {activePhotoUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in" id="photo-lightbox-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            
            <button
              onClick={() => setActivePhotoUrl(null)}
              className="absolute top-3 right-3 bg-black/75 text-white p-2 rounded-full hover:bg-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <img
              src={activePhotoUrl}
              alt="Compliance Audit Evidence"
              className="w-full h-80 object-cover"
            />

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs text-gray-500 font-bold">
              <span>Verified Evidence Snapshot Uploaded on device audit</span>
              <button
                onClick={() => setActivePhotoUrl(null)}
                className="text-[#2E7D32]"
              >
                Close Modal
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
