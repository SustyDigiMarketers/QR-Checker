import mongoose from 'mongoose';
import crypto from 'crypto';
import { db, mongoEnabled, updateMemoryCache } from '../server.js';
import { 
  UserModel, 
  OrganizationModel, 
  BuildingModel, 
  FloorModel, 
  RoomModel, 
  QRCodeModel, 
  AssignmentModel, 
  AuditLogModel,
  InspectionModel,
  SessionModel
} from '../models/index.js';
import { 
  userRepository, 
  organizationRepository, 
  buildingRepository, 
  floorRepository, 
  roomRepository, 
  qrCodeRepository, 
  assignmentRepository, 
  auditLogRepository 
} from './repositories.js';

// Cryptographically secure password hash helpers
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

// Transaction wrapper that supports replica sets and falls back gracefully on standalone instances
export async function runInTransaction<T>(fn: (session: mongoose.ClientSession | null) => Promise<T>): Promise<T> {
  if (!mongoEnabled) {
    return await fn(null);
  }

  const conn = mongoose.connection as any;
  const isReplicaSet = conn && conn.client && conn.client.topology && 
    (conn.client.topology.description.type === 'ReplicaSetNoPrimary' || 
     conn.client.topology.description.type === 'ReplicaSetWithPrimary' || 
     conn.client.topology.description.servers?.size > 1);

  if (isReplicaSet) {
    const session = await conn.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    // Standalone fallback: execute sequentially but with manual error catch-and-throw
    try {
      return await fn(null);
    } catch (error) {
      console.warn('[MongoDB] standalone mode error detected, cascade execution aborted:', error);
      throw error;
    }
  }
}

export const organizationService = {
  // CREATE ORGANIZATION WITH DEFAULTS TRANSACTION
  async createOrganization(data: { name: string; code: string; address?: string; contactEmail?: string }, operator: any): Promise<any> {
    return await runInTransaction(async (session) => {
      const orgId = `org-${Date.now()}`;
      
      // 1. Create Organization
      const org = {
        id: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        active: true,
        address: data.address || '',
        contactEmail: data.contactEmail || '',
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new OrganizationModel({ ...org, _id: orgId });
        await doc.save({ session });
      }
      if (!db.organizations) db.organizations = [];
      db.organizations.push(org);

      // 2. Create Manager (User)
      const managerId = `usr-${Date.now()}`;
      const salt = generateSalt();
      const passwordHash = hashPassword('Password123!', salt);
      
      const manager = {
        id: managerId,
        username: `mgr_${data.code.toLowerCase()}`,
        email: data.contactEmail || `manager@${data.code.toLowerCase()}.com`,
        role: 'Organization Admin',
        fullName: `Manager for ${data.name}`,
        organizationId: orgId,
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop',
        salt,
        passwordHash,
        failedLoginAttempts: 0,
        passwordVersion: 1,
        migrationVersion: 1,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new UserModel({ ...manager, _id: managerId });
        await doc.save({ session });
      }
      if (!db.users) db.users = [];
      db.users.push(manager);

      // 3. Create Default Building
      const buildingId = `bld-${Date.now()}`;
      const building = {
        id: buildingId,
        organizationId: orgId,
        name: `${data.name} HQ`,
        address: data.address || `${data.name} Main Campus`,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new BuildingModel({ ...building, _id: buildingId });
        await doc.save({ session });
      }
      if (!db.buildings) db.buildings = [];
      db.buildings.push(building);

      // 4. Create Default Floor
      const floorId = `flr-${Date.now()}`;
      const floor = {
        id: floorId,
        buildingId,
        name: 'Ground Floor',
        level: 0,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new FloorModel({ ...floor, _id: floorId });
        await doc.save({ session });
      }
      if (!db.floors) db.floors = [];
      db.floors.push(floor);

      // 5. Create Default Room
      const roomId = `rm-${Date.now()}`;
      const qrToken = `qr-tok-${crypto.randomBytes(16).toString('hex')}`;
      const room = {
        id: roomId,
        floorId,
        buildingId,
        name: 'Main Suite',
        type: 'Office',
        qrToken,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new RoomModel({ ...room, _id: roomId });
        await doc.save({ session });
      }
      if (!db.rooms) db.rooms = [];
      db.rooms.push(room);

      // 6. Create Initial QR Code
      const qr = {
        id: roomId,
        roomId,
        token: qrToken,
        generatedAt: new Date().toISOString(),
        scansCount: 0,
        status: 'Active'
      };

      if (mongoEnabled) {
        const doc = new QRCodeModel({ ...qr, _id: roomId, id: roomId });
        await doc.save({ session });
      }
      if (!db.qrCodes) db.qrCodes = [];
      db.qrCodes.push(qr);

      // 7. Create Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Create Organization',
        details: `Created organization ${data.name} (${data.code}) with standard manager, building, and QR asset defaults.`,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
      return org;
    });
  },

  // DELETE ORGANIZATION WITH CASCADE SOFT DELETION
  async deleteOrganization(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      // 1. Soft delete organization
      if (mongoEnabled) {
        await OrganizationModel.updateOne({ id }, { $set: updates }, { session });
      }
      const orgIdx = (db.organizations || []).findIndex((o: any) => o.id === id);
      if (orgIdx !== -1) db.organizations[orgIdx] = { ...db.organizations[orgIdx], ...updates };

      // 2. Soft delete managers & inspectors belonging to this org
      if (mongoEnabled) {
        await UserModel.updateMany({ organizationId: id }, { $set: updates }, { session });
      }
      (db.users || []).forEach((u: any, idx: number) => {
        if (u.organizationId === id) db.users[idx] = { ...u, ...updates };
      });

      // 3. Find buildings to cascade
      const buildings = (db.buildings || []).filter((b: any) => b.organizationId === id && !b.isDeleted);
      const bldIds = buildings.map((b: any) => b.id);

      if (bldIds.length > 0) {
        // Soft delete buildings
        if (mongoEnabled) {
          await BuildingModel.updateMany({ organizationId: id }, { $set: updates }, { session });
        }
        (db.buildings || []).forEach((b: any, idx: number) => {
          if (b.organizationId === id) db.buildings[idx] = { ...b, ...updates };
        });

        // Find floors in these buildings
        const floors = (db.floors || []).filter((f: any) => bldIds.includes(f.buildingId) && !f.isDeleted);
        const flrIds = floors.map((f: any) => f.id);

        if (flrIds.length > 0) {
          // Soft delete floors
          if (mongoEnabled) {
            await FloorModel.updateMany({ buildingId: { $in: bldIds } }, { $set: updates }, { session });
          }
          (db.floors || []).forEach((f: any, idx: number) => {
            if (bldIds.includes(f.buildingId)) db.floors[idx] = { ...f, ...updates };
          });

          // Find rooms in these floors
          const rooms = (db.rooms || []).filter((r: any) => flrIds.includes(r.floorId) && !r.isDeleted);
          const rmIds = rooms.map((r: any) => r.id);

          if (rmIds.length > 0) {
            // Soft delete rooms
            if (mongoEnabled) {
              await RoomModel.updateMany({ floorId: { $in: flrIds } }, { $set: updates }, { session });
            }
            (db.rooms || []).forEach((r: any, idx: number) => {
              if (flrIds.includes(r.floorId)) db.rooms[idx] = { ...r, ...updates };
            });

            // Deactivate QR codes
            if (mongoEnabled) {
              await QRCodeModel.updateMany({ roomId: { $in: rmIds } }, { $set: { isDeleted: true, status: 'Disabled', deletedAt: now } }, { session });
            }
            (db.qrCodes || []).forEach((q: any, idx: number) => {
              if (rmIds.includes(q.roomId)) db.qrCodes[idx] = { ...q, isDeleted: true, status: 'Disabled', deletedAt: now };
            });

            // Soft delete assignments linked to these rooms
            if (mongoEnabled) {
              await AssignmentModel.updateMany({ roomIds: { $in: rmIds } }, { $set: updates }, { session });
            }
            (db.assignments || []).forEach((asg: any, idx: number) => {
              if (asg.roomIds.some((rid: string) => rmIds.includes(rid))) {
                db.assignments[idx] = { ...asg, ...updates };
              }
            });
          }
        }
      }

      // 4. Create Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Organization',
        details: `Cascade soft-deleted organization ID: ${id} and all subordinate managers, inspectors, buildings, floors, rooms, QR codes, and assignments.`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  },

  // RESTORE ORGANIZATION WITH CASCADE RECOVERY
  async restoreOrganization(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const updates = { isDeleted: false, deletedAt: null };

      // 1. Restore organization
      if (mongoEnabled) {
        await OrganizationModel.updateOne({ id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }
      const orgIdx = (db.organizations || []).findIndex((o: any) => o.id === id);
      if (orgIdx !== -1) {
        db.organizations[orgIdx] = { ...db.organizations[orgIdx], isDeleted: false };
        delete db.organizations[orgIdx].deletedAt;
      } else {
        throw new Error('Organization not found.');
      }

      // 2. Restore managers & inspectors belonging to this org
      if (mongoEnabled) {
        await UserModel.updateMany({ organizationId: id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }
      (db.users || []).forEach((u: any, idx: number) => {
        if (u.organizationId === id) {
          db.users[idx] = { ...u, isDeleted: false };
          delete db.users[idx].deletedAt;
        }
      });

      // 3. Restore buildings
      if (mongoEnabled) {
        await BuildingModel.updateMany({ organizationId: id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }
      const bldIds: string[] = [];
      (db.buildings || []).forEach((b: any, idx: number) => {
        if (b.organizationId === id) {
          db.buildings[idx] = { ...b, isDeleted: false };
          delete db.buildings[idx].deletedAt;
          bldIds.push(b.id);
        }
      });

      if (bldIds.length > 0) {
        // Restore floors
        if (mongoEnabled) {
          await FloorModel.updateMany({ buildingId: { $in: bldIds } }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
        }
        const flrIds: string[] = [];
        (db.floors || []).forEach((f: any, idx: number) => {
          if (bldIds.includes(f.buildingId)) {
            db.floors[idx] = { ...f, isDeleted: false };
            delete db.floors[idx].deletedAt;
            flrIds.push(f.id);
          }
        });

        if (flrIds.length > 0) {
          // Restore rooms
          if (mongoEnabled) {
            await RoomModel.updateMany({ floorId: { $in: flrIds } }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
          }
          const rmIds: string[] = [];
          (db.rooms || []).forEach((r: any, idx: number) => {
            if (flrIds.includes(r.floorId)) {
              db.rooms[idx] = { ...r, isDeleted: false };
              delete db.rooms[idx].deletedAt;
              rmIds.push(r.id);
            }
          });

          if (rmIds.length > 0) {
            // Restore QR Codes
            if (mongoEnabled) {
              await QRCodeModel.updateMany({ roomId: { $in: rmIds } }, { $set: { isDeleted: false, status: 'Active' }, $unset: { deletedAt: 1 } }, { session });
            }
            (db.qrCodes || []).forEach((q: any, idx: number) => {
              if (rmIds.includes(q.roomId)) {
                db.qrCodes[idx] = { ...q, isDeleted: false, status: 'Active' };
                delete db.qrCodes[idx].deletedAt;
              }
            });

            // Restore assignments
            if (mongoEnabled) {
              await AssignmentModel.updateMany({ roomIds: { $in: rmIds } }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
            }
            (db.assignments || []).forEach((asg: any, idx: number) => {
              if (asg.roomIds && asg.roomIds.some((rid: string) => rmIds.includes(rid))) {
                db.assignments[idx] = { ...asg, isDeleted: false };
                delete db.assignments[idx].deletedAt;
              }
            });
          }
        }
      }

      // Audit Log
      const auditValId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const auditVal = {
        id: auditValId,
        timestamp: new Date().toISOString(),
        userId: operator.id,
        username: operator.username,
        action: 'Restore Organization',
        details: `Restored organization ID: ${id} and all cascaded sub-entities.`,
        createdAt: new Date().toISOString()
      };
      if (mongoEnabled) {
        await new AuditLogModel({ ...auditVal, _id: auditValId }).save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(auditVal);

      updateMemoryCache(db);
    });
  }
};

export const buildingService = {
  // DELETE BUILDING WITH CASCADE SOFT DELETION
  async deleteBuilding(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      // 1. Soft delete building
      if (mongoEnabled) {
        await BuildingModel.updateOne({ id }, { $set: updates }, { session });
      }
      const bldIdx = (db.buildings || []).findIndex((b: any) => b.id === id);
      if (bldIdx !== -1) db.buildings[bldIdx] = { ...db.buildings[bldIdx], ...updates };

      // 2. Find and soft delete floors
      const floors = (db.floors || []).filter((f: any) => f.buildingId === id && !f.isDeleted);
      const flrIds = floors.map((f: any) => f.id);

      if (flrIds.length > 0) {
        if (mongoEnabled) {
          await FloorModel.updateMany({ buildingId: id }, { $set: updates }, { session });
        }
        (db.floors || []).forEach((f: any, idx: number) => {
          if (f.buildingId === id) db.floors[idx] = { ...f, ...updates };
        });

        // 3. Find and soft delete rooms
        const rooms = (db.rooms || []).filter((r: any) => flrIds.includes(r.floorId) && !r.isDeleted);
        const rmIds = rooms.map((r: any) => r.id);

        if (rmIds.length > 0) {
          if (mongoEnabled) {
            await RoomModel.updateMany({ floorId: { $in: flrIds } }, { $set: updates }, { session });
          }
          (db.rooms || []).forEach((r: any, idx: number) => {
            if (flrIds.includes(r.floorId)) db.rooms[idx] = { ...r, ...updates };
          });

          // 4. Deactivate QR codes
          if (mongoEnabled) {
            await QRCodeModel.updateMany({ roomId: { $in: rmIds } }, { $set: { isDeleted: true, status: 'Disabled', deletedAt: now } }, { session });
          }
          (db.qrCodes || []).forEach((q: any, idx: number) => {
            if (rmIds.includes(q.roomId)) db.qrCodes[idx] = { ...q, isDeleted: true, status: 'Disabled', deletedAt: now };
          });

          // 5. Soft delete assignments
          if (mongoEnabled) {
            await AssignmentModel.updateMany({ roomIds: { $in: rmIds } }, { $set: updates }, { session });
          }
          (db.assignments || []).forEach((asg: any, idx: number) => {
            if (asg.roomIds.some((rid: string) => rmIds.includes(rid))) {
              db.assignments[idx] = { ...asg, ...updates };
            }
          });
        }
      }

      // 6. Create Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Building',
        details: `Cascade soft-deleted building ID: ${id} along with its floors, rooms, associated active QR codes, and roster assignments.`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  },

  // RESTORE BUILDING WITH CASCADE RECOVERY
  async restoreBuilding(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const updates = { isDeleted: false, deletedAt: null };

      // 1. Restore building
      if (mongoEnabled) {
        await BuildingModel.updateOne({ id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }
      const bldIdx = (db.buildings || []).findIndex((b: any) => b.id === id);
      if (bldIdx !== -1) {
        db.buildings[bldIdx] = { ...db.buildings[bldIdx], isDeleted: false };
        delete db.buildings[bldIdx].deletedAt;
      } else {
        throw new Error('Building not found.');
      }

      // 2. Restore floors belonging to this building
      if (mongoEnabled) {
        await FloorModel.updateMany({ buildingId: id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }
      const flrIds: string[] = [];
      (db.floors || []).forEach((f: any, idx: number) => {
        if (f.buildingId === id) {
          db.floors[idx] = { ...f, isDeleted: false };
          delete db.floors[idx].deletedAt;
          flrIds.push(f.id);
        }
      });

      if (flrIds.length > 0) {
        // 3. Restore rooms
        if (mongoEnabled) {
          await RoomModel.updateMany({ floorId: { $in: flrIds } }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
        }
        const rmIds: string[] = [];
        (db.rooms || []).forEach((r: any, idx: number) => {
          if (flrIds.includes(r.floorId)) {
            db.rooms[idx] = { ...r, isDeleted: false };
            delete db.rooms[idx].deletedAt;
            rmIds.push(r.id);
          }
        });

        if (rmIds.length > 0) {
          // 4. Restore QR codes
          if (mongoEnabled) {
            await QRCodeModel.updateMany({ roomId: { $in: rmIds } }, { $set: { isDeleted: false, status: 'Active' }, $unset: { deletedAt: 1 } }, { session });
          }
          (db.qrCodes || []).forEach((q: any, idx: number) => {
            if (rmIds.includes(q.roomId)) {
              db.qrCodes[idx] = { ...q, isDeleted: false, status: 'Active' };
              delete db.qrCodes[idx].deletedAt;
            }
          });

          // 5. Restore assignments
          if (mongoEnabled) {
            await AssignmentModel.updateMany({ roomIds: { $in: rmIds } }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
          }
          (db.assignments || []).forEach((a: any, idx: number) => {
            if (a.roomIds && a.roomIds.some((rId: string) => rmIds.includes(rId))) {
              db.assignments[idx] = { ...a, isDeleted: false };
              delete db.assignments[idx].deletedAt;
            }
          });
        }
      }

      // Audit Log
      const auditValId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const auditVal = {
        id: auditValId,
        timestamp: new Date().toISOString(),
        userId: operator.id,
        username: operator.username,
        action: 'Restore Building',
        details: `Restored building ID: ${id} and all cascaded sub-entities.`,
        createdAt: new Date().toISOString()
      };
      if (mongoEnabled) {
        await new AuditLogModel({ ...auditVal, _id: auditValId }).save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(auditVal);

      updateMemoryCache(db);
    });
  }
};

export const floorService = {
  // DELETE FLOOR WITH CASCADE SOFT DELETION
  async deleteFloor(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      // 1. Soft delete floor
      if (mongoEnabled) {
        await FloorModel.updateOne({ id }, { $set: updates }, { session });
      }
      const flrIdx = (db.floors || []).findIndex((f: any) => f.id === id);
      if (flrIdx !== -1) db.floors[flrIdx] = { ...db.floors[flrIdx], ...updates };

      // 2. Find and soft delete rooms
      const rooms = (db.rooms || []).filter((r: any) => r.floorId === id && !r.isDeleted);
      const rmIds = rooms.map((r: any) => r.id);

      if (rmIds.length > 0) {
        if (mongoEnabled) {
          await RoomModel.updateMany({ floorId: id }, { $set: updates }, { session });
        }
        (db.rooms || []).forEach((r: any, idx: number) => {
          if (r.floorId === id) db.rooms[idx] = { ...r, ...updates };
        });

        // 3. Deactivate QR codes
        if (mongoEnabled) {
          await QRCodeModel.updateMany({ roomId: { $in: rmIds } }, { $set: { isDeleted: true, status: 'Disabled', deletedAt: now } }, { session });
        }
        (db.qrCodes || []).forEach((q: any, idx: number) => {
          if (rmIds.includes(q.roomId)) db.qrCodes[idx] = { ...q, isDeleted: true, status: 'Disabled', deletedAt: now };
        });

        // 4. Soft delete assignments
        if (mongoEnabled) {
          await AssignmentModel.updateMany({ roomIds: { $in: rmIds } }, { $set: updates }, { session });
        }
        (db.assignments || []).forEach((asg: any, idx: number) => {
          if (asg.roomIds.some((rid: string) => rmIds.includes(rid))) {
            db.assignments[idx] = { ...asg, ...updates };
          }
        });
      }

      // 5. Create Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Floor',
        details: `Cascade soft-deleted floor ID: ${id}, containing rooms, QR code entries, and shift assignments.`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  }
};

export const roomService = {
  // DELETE ROOM WITH CASCADE SOFT DELETION
  async deleteRoom(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      // 1. Soft delete room
      if (mongoEnabled) {
        await RoomModel.updateOne({ id }, { $set: updates }, { session });
      }
      const rmIdx = (db.rooms || []).findIndex((r: any) => r.id === id);
      if (rmIdx !== -1) db.rooms[rmIdx] = { ...db.rooms[rmIdx], ...updates };

      // 2. Deactivate QR code
      if (mongoEnabled) {
        await QRCodeModel.updateOne({ roomId: id }, { $set: { isDeleted: true, status: 'Disabled', deletedAt: now } }, { session });
      }
      const qrIdx = (db.qrCodes || []).findIndex((q: any) => q.roomId === id);
      if (qrIdx !== -1) db.qrCodes[qrIdx] = { ...db.qrCodes[qrIdx], isDeleted: true, status: 'Disabled', deletedAt: now };

      // 3. Soft delete assignments
      if (mongoEnabled) {
        await AssignmentModel.updateMany({ roomIds: id }, { $set: updates }, { session });
      }
      (db.assignments || []).forEach((asg: any, idx: number) => {
        if (asg.roomIds.includes(id)) {
          db.assignments[idx] = { ...asg, ...updates };
        }
      });

      // 4. Create Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Room',
        details: `Soft-deleted room ID: ${id}, deactivated its QR verification key, and updated rosters.`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  }
};

export const userService = {
  async deleteUser(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      let user;
      if (mongoEnabled) {
        user = await UserModel.findOne({ id, isDeleted: { $ne: true } }).session(session);
      } else {
        user = (db.users || []).find((u: any) => u.id === id && !u.isDeleted);
      }
      if (!user) {
        throw new Error('User not found.');
      }

      if (operator.role === 'Organization Admin') {
        if (user.organizationId !== operator.organizationId) {
          throw new Error('Access denied: Target user belongs to a different organization.');
        }
        if (user.role !== 'Inspector') {
          throw new Error('Managers can only delete Inspector accounts.');
        }
      }

      if (mongoEnabled) {
        await UserModel.updateOne({ id }, { $set: updates }, { session });
      }

      const idx = (db.users || []).findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...updates };
      }

      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete User',
        details: `Soft deleted user: ${user.username} (Role: ${user.role})`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  },

  async restoreUser(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const updates = { isDeleted: false, deletedAt: null };

      let user;
      if (mongoEnabled) {
        user = await UserModel.findOne({ id }).session(session);
      } else {
        user = (db.users || []).find((u: any) => u.id === id);
      }
      if (!user) {
        throw new Error('User not found.');
      }

      if (operator.role === 'Organization Admin') {
        if (user.organizationId !== operator.organizationId) {
          throw new Error('Access denied: Target user belongs to a different organization.');
        }
      }

      if (mongoEnabled) {
        await UserModel.updateOne({ id }, { $set: updates, $unset: { deletedAt: 1 } }, { session });
      }

      const idx = (db.users || []).findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], isDeleted: false };
        delete db.users[idx].deletedAt;
      }

      // Audit Log
      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Restore User',
        details: `Restored user: ${user.username} (Role: ${user.role})`,
        createdAt: new Date().toISOString()
      };
      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  }
};

export const assignmentService = {
  async deleteAssignment(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      let assignment;
      if (mongoEnabled) {
        assignment = await AssignmentModel.findOne({ id, isDeleted: { $ne: true } }).session(session);
      } else {
        assignment = (db.assignments || []).find((a: any) => a.id === id && !a.isDeleted);
      }
      if (!assignment) {
        throw new Error('Assignment not found.');
      }

      if (operator.role === 'Organization Admin') {
        let inspector;
        if (mongoEnabled) {
          inspector = await UserModel.findOne({ id: assignment.inspectorId, isDeleted: { $ne: true } }).session(session);
        } else {
          inspector = (db.users || []).find((u: any) => u.id === assignment.inspectorId && !u.isDeleted);
        }
        if (inspector && inspector.organizationId !== operator.organizationId) {
          throw new Error('Access denied: Assignment belongs to a different organization.');
        }
      }

      if (mongoEnabled) {
        await AssignmentModel.updateOne({ id }, { $set: updates }, { session });
      }

      const idx = (db.assignments || []).findIndex((a: any) => a.id === id);
      if (idx !== -1) {
        db.assignments[idx] = { ...db.assignments[idx], ...updates };
      }

      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Assignment',
        details: `Removed daily assignment for ${assignment.inspectorName || 'Inspector'} on ${assignment.date}`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  }
};

export const inspectionService = {
  async deleteInspection(id: string, operator: any): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date().toISOString();
      const updates = { isDeleted: true, deletedAt: now };

      let inspection;
      if (mongoEnabled) {
        inspection = await InspectionModel.findOne({ id, isDeleted: { $ne: true } }).session(session);
      } else {
        inspection = (db.inspections || []).find((i: any) => i.id === id && !i.isDeleted);
      }
      if (!inspection) {
        throw new Error('Inspection not found.');
      }

      if (operator.role === 'Organization Admin') {
        let room;
        if (mongoEnabled) {
          room = await RoomModel.findOne({ id: inspection.roomId }).session(session);
        } else {
          room = (db.rooms || []).find((r: any) => r.id === inspection.roomId);
        }
        if (room) {
          let building;
          if (mongoEnabled) {
            building = await BuildingModel.findOne({ id: room.buildingId }).session(session);
          } else {
            building = (db.buildings || []).find((b: any) => b.id === room.buildingId);
          }
          if (building && building.organizationId !== operator.organizationId) {
            throw new Error('Access denied: Inspection belongs to a different organization.');
          }
        }
      }

      if (mongoEnabled) {
        await InspectionModel.updateOne({ id }, { $set: updates }, { session });
      }

      const idx = (db.inspections || []).findIndex((i: any) => i.id === id);
      if (idx !== -1) {
        db.inspections[idx] = { ...db.inspections[idx], ...updates };
      }

      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Delete Inspection Log',
        details: `Deleted inspection report ID: ${id}`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
    });
  }
};

export const qrCodeService = {
  async regenerateQR(roomId: string, newToken: string, operator: any): Promise<any> {
    return await runInTransaction(async (session) => {
      const now = new Date().toISOString();

      let room;
      if (mongoEnabled) {
        room = await RoomModel.findOne({ id: roomId, isDeleted: { $ne: true } }).session(session);
      } else {
        room = (db.rooms || []).find((r: any) => r.id === roomId && !r.isDeleted);
      }
      if (!room) {
        throw new Error('Room not found');
      }

      let building;
      if (mongoEnabled) {
        building = await BuildingModel.findOne({ id: room.buildingId, isDeleted: { $ne: true } }).session(session);
      } else {
        building = (db.buildings || []).find((b: any) => b.id === room.buildingId && !b.isDeleted);
      }
      if (building && operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
        throw new Error('Access denied: Room belongs to a different organization.');
      }

      let qr;
      if (mongoEnabled) {
        qr = await QRCodeModel.findOne({ roomId }).session(session);
      } else {
        qr = (db.qrCodes || []).find((q: any) => q.roomId === roomId && !q.isDeleted);
      }
      if (!qr) {
        throw new Error('QR Details not found');
      }

      if (mongoEnabled) {
        await RoomModel.updateOne({ id: roomId }, { $set: { qrToken: newToken, updatedAt: now } }, { session });
        await QRCodeModel.updateOne({ roomId }, { $set: { token: newToken, generatedAt: now } }, { session });
      }

      const rIdx = db.rooms.findIndex((r: any) => r.id === roomId);
      if (rIdx !== -1) {
        db.rooms[rIdx].qrToken = newToken;
      }

      const qIdx = db.qrCodes.findIndex((q: any) => q.roomId === roomId);
      let updatedQr: any = null;
      if (qIdx !== -1) {
        db.qrCodes[qIdx].token = newToken;
        db.qrCodes[qIdx].generatedAt = now;
        updatedQr = db.qrCodes[qIdx];
      }

      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Regenerate QR Code',
        details: `Regenerated secure 128-bit token for Room: ${room.name}`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
      return updatedQr;
    });
  },

  async toggleQR(roomId: string, operator: any): Promise<any> {
    return await runInTransaction(async (session) => {
      const now = new Date().toISOString();

      let room;
      if (mongoEnabled) {
        room = await RoomModel.findOne({ id: roomId, isDeleted: { $ne: true } }).session(session);
      } else {
        room = (db.rooms || []).find((r: any) => r.id === roomId && !r.isDeleted);
      }
      if (!room) {
        throw new Error('Room not found');
      }

      let building;
      if (mongoEnabled) {
        building = await BuildingModel.findOne({ id: room.buildingId, isDeleted: { $ne: true } }).session(session);
      } else {
        building = (db.buildings || []).find((b: any) => b.id === room.buildingId && !b.isDeleted);
      }
      if (building && operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
        throw new Error('Access denied: Room belongs to a different organization.');
      }

      let qr;
      if (mongoEnabled) {
        qr = await QRCodeModel.findOne({ roomId }).session(session);
      } else {
        qr = (db.qrCodes || []).find((q: any) => q.roomId === roomId && !q.isDeleted);
      }
      if (!qr) {
        throw new Error('QR Code details not found');
      }

      const currentStatus = qr.status;
      const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';

      if (mongoEnabled) {
        await QRCodeModel.updateOne({ roomId }, { $set: { status: newStatus } }, { session });
      }

      const idx = db.qrCodes.findIndex((q: any) => q.roomId === roomId);
      let updatedQr: any = null;
      if (idx !== -1) {
        db.qrCodes[idx].status = newStatus;
        updatedQr = db.qrCodes[idx];
      }

      const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const audit = {
        id: auditId,
        userId: operator.id,
        username: operator.username,
        action: 'Toggle QR Code',
        details: `Changed QR Code status to ${newStatus} for Room ID: ${roomId}`,
        createdAt: now
      };

      if (mongoEnabled) {
        const doc = new AuditLogModel({ ...audit, _id: auditId });
        await doc.save({ session });
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push(audit);

      updateMemoryCache(db);
      return updatedQr;
    });
  }
};

export const sessionService = {
  async deleteSession(token: string, userId?: string): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date();
      const updates = { isDeleted: true, deletedAt: now };

      if (mongoEnabled) {
        await SessionModel.updateOne({ id: token }, { $set: updates }, { session });
      }

      if (userId) {
        let user;
        if (mongoEnabled) {
          user = await UserModel.findOne({ id: userId }).session(session);
        } else {
          user = (db.users || []).find((u: any) => u.id === userId && !u.isDeleted);
        }
        if (user) {
          const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const audit = {
            id: auditId,
            userId: user.id,
            username: user.username,
            action: 'User Logout',
            details: 'Logged out of active session.',
            createdAt: now.toISOString()
          };

          if (mongoEnabled) {
            const doc = new AuditLogModel({ ...audit, _id: auditId });
            await doc.save({ session });
          }
          if (!db.auditLogs) db.auditLogs = [];
          db.auditLogs.push(audit);
        }
      }

      updateMemoryCache(db);
    });
  },

  async deleteUserSessions(userId: string): Promise<void> {
    await runInTransaction(async (session) => {
      const now = new Date();
      const updates = { isDeleted: true, deletedAt: now };

      if (mongoEnabled) {
        await SessionModel.updateMany({ userId }, { $set: updates }, { session });
      }

      let user;
      if (mongoEnabled) {
        user = await UserModel.findOne({ id: userId }).session(session);
      } else {
        user = (db.users || []).find((u: any) => u.id === userId && !u.isDeleted);
      }
      if (user) {
        const auditId = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const audit = {
          id: auditId,
          userId: user.id,
          username: user.username,
          action: 'User Logout All',
          details: 'Logged out of all active devices/sessions.',
          createdAt: now.toISOString()
        };

        if (mongoEnabled) {
          const doc = new AuditLogModel({ ...audit, _id: auditId });
          await doc.save({ session });
        }
        if (!db.auditLogs) db.auditLogs = [];
        db.auditLogs.push(audit);
      }

      updateMemoryCache(db);
    });
  }
};
