import { db, mongoEnabled, updateMemoryCache } from '../server.js';
import { 
  UserModel, 
  OrganizationModel, 
  BuildingModel, 
  FloorModel, 
  RoomModel, 
  QRCodeModel, 
  AssignmentModel, 
  InspectionModel, 
  AuditLogModel, 
  SessionModel, 
  SettingModel 
} from '../models/index.js';

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export async function paginate<T>(
  model: any,
  localItems: T[],
  query: any = {},
  page: number = 1,
  limit: number = 20,
  searchField?: string,
  searchValue?: string,
  sortField: string = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<PaginatedResult<T>> {
  const cleanQuery = { isDeleted: { $ne: true }, ...query };

  if (mongoEnabled) {
    let mongoQuery = { ...cleanQuery };
    if (searchField && searchValue) {
      mongoQuery[searchField] = { $regex: searchValue, $options: 'i' };
    }
    
    const count = await model.countDocuments(mongoQuery);
    const totalPages = Math.ceil(count / limit);
    const skip = (page - 1) * limit;
    
    const data = await model.find(mongoQuery)
      .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Performance: avoid document hydration for read-only
      
    return {
      data: data.map((d: any) => ({ ...d, id: d._id || d.id })),
      page,
      limit,
      total: count,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  } else {
    let items = [...(localItems || [])];
    
    // Filter active (non soft-deleted)
    items = items.filter((item: any) => !item.isDeleted);
    
    // Filter by query
    for (const [key, val] of Object.entries(query)) {
      if (val !== undefined) {
        items = items.filter((item: any) => item[key] === val);
      }
    }
    
    // Search
    if (searchField && searchValue) {
      const regex = new RegExp(searchValue, 'i');
      items = items.filter((item: any) => regex.test(item[searchField]));
    }
    
    // Sort
    items.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
    });
    
    const count = items.length;
    const totalPages = Math.ceil(count / limit);
    const skip = (page - 1) * limit;
    const data = items.slice(skip, skip + limit);
    
    return {
      data,
      page,
      limit,
      total: count,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
}

// --- USER REPOSITORY ---
export const userRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await UserModel.find(cleanQuery).lean();
    } else {
      return (db.users || []).filter((u: any) => !u.isDeleted && Object.entries(query).every(([k, v]) => u[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await UserModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.users || []).find((u: any) => u.id === id && !u.isDeleted) || null;
    }
  },

  async findByUsername(username: string): Promise<any | null> {
    if (mongoEnabled) {
      return await UserModel.findOne({ username, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.users || []).find((u: any) => u.username === username && !u.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new UserModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.users) db.users = [];
    db.users.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await UserModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.users || []).findIndex((u: any) => u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.users[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await UserModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.users || []).findIndex((u: any) => u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- ORGANIZATION REPOSITORY ---
export const organizationRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await OrganizationModel.find(cleanQuery).lean();
    } else {
      return (db.organizations || []).filter((o: any) => !o.isDeleted && Object.entries(query).every(([k, v]) => o[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await OrganizationModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.organizations || []).find((o: any) => o.id === id && !o.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new OrganizationModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.organizations) db.organizations = [];
    db.organizations.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await OrganizationModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.organizations || []).findIndex((o: any) => o.id === id);
    if (idx !== -1) {
      db.organizations[idx] = { ...db.organizations[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.organizations[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await OrganizationModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.organizations || []).findIndex((o: any) => o.id === id);
    if (idx !== -1) {
      db.organizations[idx] = { ...db.organizations[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- BUILDING REPOSITORY ---
export const buildingRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await BuildingModel.find(cleanQuery).lean();
    } else {
      return (db.buildings || []).filter((b: any) => !b.isDeleted && Object.entries(query).every(([k, v]) => b[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await BuildingModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.buildings || []).find((b: any) => b.id === id && !b.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new BuildingModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.buildings) db.buildings = [];
    db.buildings.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await BuildingModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.buildings || []).findIndex((b: any) => b.id === id);
    if (idx !== -1) {
      db.buildings[idx] = { ...db.buildings[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.buildings[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await BuildingModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.buildings || []).findIndex((b: any) => b.id === id);
    if (idx !== -1) {
      db.buildings[idx] = { ...db.buildings[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- FLOOR REPOSITORY ---
export const floorRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await FloorModel.find(cleanQuery).lean();
    } else {
      return (db.floors || []).filter((f: any) => !f.isDeleted && Object.entries(query).every(([k, v]) => f[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await FloorModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.floors || []).find((f: any) => f.id === id && !f.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new FloorModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.floors) db.floors = [];
    db.floors.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await FloorModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.floors || []).findIndex((f: any) => f.id === id);
    if (idx !== -1) {
      db.floors[idx] = { ...db.floors[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.floors[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await FloorModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.floors || []).findIndex((f: any) => f.id === id);
    if (idx !== -1) {
      db.floors[idx] = { ...db.floors[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- ROOM REPOSITORY ---
export const roomRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await RoomModel.find(cleanQuery).lean();
    } else {
      return (db.rooms || []).filter((r: any) => !r.isDeleted && Object.entries(query).every(([k, v]) => r[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await RoomModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.rooms || []).find((r: any) => r.id === id && !r.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new RoomModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.rooms) db.rooms = [];
    db.rooms.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await RoomModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.rooms || []).findIndex((r: any) => r.id === id);
    if (idx !== -1) {
      db.rooms[idx] = { ...db.rooms[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.rooms[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await RoomModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.rooms || []).findIndex((r: any) => r.id === id);
    if (idx !== -1) {
      db.rooms[idx] = { ...db.rooms[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- QR CODE REPOSITORY ---
export const qrCodeRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await QRCodeModel.find(cleanQuery).lean();
    } else {
      return (db.qrCodes || []).filter((q: any) => !q.isDeleted && Object.entries(query).every(([k, v]) => q[k] === v));
    }
  },

  async findByRoomId(roomId: string): Promise<any | null> {
    if (mongoEnabled) {
      return await QRCodeModel.findOne({ roomId, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.qrCodes || []).find((q: any) => q.roomId === roomId && !q.isDeleted) || null;
    }
  },

  async findByToken(token: string): Promise<any | null> {
    if (mongoEnabled) {
      return await QRCodeModel.findOne({ token, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.qrCodes || []).find((q: any) => q.token === token && !q.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new QRCodeModel({ ...item, _id: item.roomId });
      await modelDoc.save();
    }
    if (!db.qrCodes) db.qrCodes = [];
    db.qrCodes.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(roomId: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await QRCodeModel.updateOne({ roomId }, { $set: cleanUpdates });
    }
    const idx = (db.qrCodes || []).findIndex((q: any) => q.roomId === roomId);
    if (idx !== -1) {
      db.qrCodes[idx] = { ...db.qrCodes[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.qrCodes[idx];
    }
    return null;
  },

  async deleteByRoomId(roomId: string): Promise<boolean> {
    const updates = { isDeleted: true, status: 'Disabled', deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await QRCodeModel.updateOne({ roomId }, { $set: updates });
    }
    const idx = (db.qrCodes || []).findIndex((q: any) => q.roomId === roomId);
    if (idx !== -1) {
      db.qrCodes[idx] = { ...db.qrCodes[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- ASSIGNMENT REPOSITORY ---
export const assignmentRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await AssignmentModel.find(cleanQuery).lean();
    } else {
      return (db.assignments || []).filter((a: any) => !a.isDeleted && Object.entries(query).every(([k, v]) => a[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await AssignmentModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.assignments || []).find((a: any) => a.id === id && !a.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new AssignmentModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.assignments) db.assignments = [];
    db.assignments.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await AssignmentModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.assignments || []).findIndex((a: any) => a.id === id);
    if (idx !== -1) {
      db.assignments[idx] = { ...db.assignments[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.assignments[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await AssignmentModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.assignments || []).findIndex((a: any) => a.id === id);
    if (idx !== -1) {
      db.assignments[idx] = { ...db.assignments[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- INSPECTION REPOSITORY ---
export const inspectionRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await InspectionModel.find(cleanQuery).lean();
    } else {
      return (db.inspections || []).filter((i: any) => !i.isDeleted && Object.entries(query).every(([k, v]) => i[k] === v));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await InspectionModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      return (db.inspections || []).find((i: any) => i.id === id && !i.isDeleted) || null;
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new InspectionModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.inspections) db.inspections = [];
    db.inspections.push(item);
    updateMemoryCache(db);
    return item;
  },

  async update(id: string, updates: any): Promise<any> {
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await InspectionModel.updateOne({ id }, { $set: cleanUpdates });
    }
    const idx = (db.inspections || []).findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      db.inspections[idx] = { ...db.inspections[idx], ...cleanUpdates };
      updateMemoryCache(db);
      return db.inspections[idx];
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const updates = { isDeleted: true, deletedAt: new Date().toISOString() };
    if (mongoEnabled) {
      await InspectionModel.updateOne({ id }, { $set: updates });
    }
    const idx = (db.inspections || []).findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      db.inspections[idx] = { ...db.inspections[idx], ...updates };
      updateMemoryCache(db);
      return true;
    }
    return false;
  }
};

// --- AUDIT LOG REPOSITORY ---
export const auditLogRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await AuditLogModel.find(cleanQuery).lean();
    } else {
      return (db.auditLogs || []).filter((a: any) => !a.isDeleted && Object.entries(query).every(([k, v]) => a[k] === v));
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new AuditLogModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.push(item);
    updateMemoryCache(db);
    return item;
  }
};

// --- SESSION REPOSITORY ---
export const sessionRepository = {
  async find(query: any = {}): Promise<any[]> {
    const cleanQuery = { isDeleted: { $ne: true }, ...query };
    if (mongoEnabled) {
      return await SessionModel.find(cleanQuery).lean();
    } else {
      return Object.entries(db.sessions || {}).map(([token, s]: [string, any]) => ({ id: token, ...s }));
    }
  },

  async findById(id: string): Promise<any | null> {
    if (mongoEnabled) {
      return await SessionModel.findOne({ id, isDeleted: { $ne: true } }).lean();
    } else {
      // Localactive session in activeSessions mapping
      return null; // sessions managed separately in memory
    }
  },

  async insert(doc: any): Promise<any> {
    const item = { ...doc, isDeleted: false };
    if (mongoEnabled) {
      const modelDoc = new SessionModel({ ...item, _id: item.id });
      await modelDoc.save();
    }
    return item;
  },

  async delete(id: string): Promise<boolean> {
    if (mongoEnabled) {
      await SessionModel.updateOne({ id }, { $set: { isDeleted: true, deletedAt: new Date().toISOString() } });
    }
    return true;
  }
};

// --- SETTING REPOSITORY ---
export const settingRepository = {
  async getGlobal(): Promise<any> {
    if (mongoEnabled) {
      return await SettingModel.findOne({ _id: 'global' }).lean() || db.settings;
    } else {
      return db.settings;
    }
  },

  async updateGlobal(updates: any): Promise<any> {
    if (mongoEnabled) {
      await SettingModel.updateOne({ _id: 'global' }, { $set: updates }, { upsert: true });
    }
    db.settings = { ...db.settings, ...updates };
    updateMemoryCache(db);
    return db.settings;
  }
};
