import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
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
  SettingModel 
} from '../models/index.js';
import { 
  paginate, 
  userRepository, 
  organizationRepository, 
  buildingRepository, 
  floorRepository, 
  roomRepository, 
  qrCodeRepository, 
  assignmentRepository, 
  inspectionRepository, 
  auditLogRepository, 
  settingRepository 
} from './repositories.js';
import { organizationService, buildingService, floorService, roomService, runInTransaction } from './services.js';

export const dashboardController = {
  // GET /api/dashboard
  async getGeneralStats(req: Request, res: Response) {
    try {
      const operator = (req as any).user;
      let targetOrgId = operator.role === 'Super Admin' ? null : operator.organizationId;

      if (mongoEnabled) {
        const orgMatch = targetOrgId ? { id: targetOrgId, isDeleted: { $ne: true } } : { isDeleted: { $ne: true } };
        const userMatch = targetOrgId ? { organizationId: targetOrgId, isDeleted: { $ne: true } } : { isDeleted: { $ne: true } };
        const bldMatch = targetOrgId ? { organizationId: targetOrgId, isDeleted: { $ne: true } } : { isDeleted: { $ne: true } };

        const [orgCount, bldCount, userCount, usersByRole, recentLogs] = await Promise.all([
          OrganizationModel.countDocuments(orgMatch),
          BuildingModel.countDocuments(bldMatch),
          UserModel.countDocuments(userMatch),
          UserModel.aggregate([
            { $match: userMatch },
            { $group: { _id: '$role', count: { $sum: 1 } } }
          ]),
          AuditLogModel.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(10).lean()
        ]);

        const roleBreakdown = usersByRole.reduce((acc: any, curr: any) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {});

        res.json({
          mongoActive: true,
          organizations: orgCount,
          buildings: bldCount,
          users: userCount,
          roles: roleBreakdown,
          recentLogs,
          systemHealth: 'CONNECTED'
        });
      } else {
        // Fallback Javascript processing
        const orgs = (db.organizations || []).filter((o: any) => !o.isDeleted && (!targetOrgId || o.id === targetOrgId));
        const blds = (db.buildings || []).filter((b: any) => !b.isDeleted && (!targetOrgId || b.organizationId === targetOrgId));
        const users = (db.users || []).filter((u: any) => !u.isDeleted && (!targetOrgId || u.organizationId === targetOrgId));

        const roleBreakdown = users.reduce((acc: any, u: any) => {
          acc[u.role] = (acc[u.role] || 0) + 1;
          return acc;
        }, {});

        const recentLogs = (db.auditLogs || [])
          .filter((l: any) => !l.isDeleted)
          .slice(0, 10);

        res.json({
          mongoActive: false,
          organizations: orgs.length,
          buildings: blds.length,
          users: users.length,
          roles: roleBreakdown,
          recentLogs,
          systemHealth: 'DEGRADED'
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET /api/dashboard/building
  async getBuildingStats(req: Request, res: Response) {
    try {
      const operator = (req as any).user;
      let targetOrgId = operator.role === 'Super Admin' ? null : operator.organizationId;
      const bldId = typeof req.query.buildingId === 'string' ? req.query.buildingId : undefined;

      if (mongoEnabled) {
        // MONGODB AGGREGATION PIPELINE (Phase 5)
        const matchQuery: any = { isDeleted: { $ne: true } };
        if (targetOrgId) matchQuery.organizationName = { $regex: new RegExp(targetOrgId, 'i') }; // Approximate link or filter via IDs
        if (bldId) {
          const bld = await BuildingModel.findOne({ id: bldId, isDeleted: { $ne: true } }).lean();
          if (bld) matchQuery.buildingName = bld.name;
        }

        // Aggregate stats in a single pass using $facet
        const statsAggregation = await InspectionModel.aggregate([
          { $match: matchQuery },
          {
            $facet: {
              summary: [
                {
                  $group: {
                    _id: null,
                    totalInspections: { $sum: 1 },
                    compliant: { $sum: { $cond: [{ $or: [{ $gte: ["$rating", 4] }, { $eq: ["$cleaned", true] }] }, 1, 0] } },
                    deficient: { $sum: { $cond: [{ $lt: ["$rating", 3] }, 1, 0] } },
                    ratingSum: { $sum: "$rating" }
                  }
                }
              ],
              byBuilding: [
                {
                  $group: {
                    _id: "$buildingName",
                    inspectionsCount: { $sum: 1 },
                    ratingSum: { $sum: "$rating" }
                  }
                },
                {
                  $project: {
                    buildingName: "$_id",
                    inspectionsCount: 1,
                    avgRating: { $cond: ["$inspectionsCount", { $round: [{ $divide: ["$ratingSum", "$inspectionsCount"] }, 1] }, 0] }
                  }
                },
                { $sort: { inspectionsCount: -1 } }
              ],
              leaderboard: [
                {
                  $group: {
                    _id: "$inspectorName",
                    inspectionsCompleted: { $sum: 1 },
                    compliant: { $sum: { $cond: [{ $or: [{ $gte: ["$rating", 4] }, { $eq: ["$cleaned", true] }] }, 1, 0] } }
                  }
                },
                {
                  $project: {
                    inspectorName: "$_id",
                    inspectionsCompleted: 1,
                    complianceRate: { $cond: ["$inspectionsCompleted", { $round: [{ $multiply: [{ $divide: ["$compliant", "$inspectionsCompleted"] }, 100] }, 1] }, 0] }
                  }
                },
                { $sort: { inspectionsCompleted: -1 } },
                { $limit: 10 }
              ]
            }
          }
        ]);

        const rawSummary = statsAggregation[0]?.summary[0] || { totalInspections: 0, compliant: 0, deficient: 0, ratingSum: 0 };
        const total = rawSummary.totalInspections;
        const complianceRate = total > 0 ? parseFloat(((rawSummary.compliant / total) * 100).toFixed(1)) : 0;
        const averageRating = total > 0 ? parseFloat((rawSummary.ratingSum / total).toFixed(1)) : 0;

        res.json({
          totalInspections: total,
          complianceRate,
          deficientCount: rawSummary.deficient,
          averageRating,
          byBuilding: statsAggregation[0]?.byBuilding || [],
          leaderboard: statsAggregation[0]?.leaderboard || []
        });
      } else {
        // Fallback JS Loops processing (Phase 5 fallback)
        let inspections = (db.inspections || []).filter((i: any) => !i.isDeleted);
        
        if (targetOrgId) {
          const org = (db.organizations || []).find((o: any) => o.id === targetOrgId);
          if (org) {
            inspections = inspections.filter((i: any) => i.organizationName === org.name);
          }
        }
        if (bldId) {
          const bld = (db.buildings || []).find((b: any) => b.id === bldId);
          if (bld) {
            inspections = inspections.filter((i: any) => i.buildingName === bld.name);
          }
        }

        const total = inspections.length;
        let compliantCount = 0;
        let deficientCount = 0;
        let ratingSum = 0;

        const buildingMap: Record<string, { buildingName: string; inspectionsCount: number; ratingSum: number }> = {};
        const inspectorMap: Record<string, { inspectorName: string; inspectionsCompleted: number; compliantCount: number }> = {};

        inspections.forEach((i: any) => {
          const isCompliant = i.rating >= 4 || i.cleaned === true;
          const isDeficient = i.rating < 3;

          if (isCompliant) compliantCount++;
          if (isDeficient) deficientCount++;
          ratingSum += i.rating;

          // Building grouping
          const bName = i.buildingName || 'Unknown Building';
          if (!buildingMap[bName]) {
            buildingMap[bName] = { buildingName: bName, inspectionsCount: 0, ratingSum: 0 };
          }
          buildingMap[bName].inspectionsCount++;
          buildingMap[bName].ratingSum += i.rating;

          // Inspector grouping
          const insName = i.inspectorName || 'Unknown Inspector';
          if (!inspectorMap[insName]) {
            inspectorMap[insName] = { inspectorName: insName, inspectionsCompleted: 0, compliantCount: 0 };
          }
          inspectorMap[insName].inspectionsCompleted++;
          if (isCompliant) inspectorMap[insName].compliantCount++;
        });

        const byBuilding = Object.values(buildingMap).map((b: any) => ({
          buildingName: b.buildingName,
          inspectionsCount: b.inspectionsCount,
          avgRating: b.inspectionsCount > 0 ? parseFloat((b.ratingSum / b.inspectionsCount).toFixed(1)) : 0
        })).sort((a, b) => b.inspectionsCount - a.inspectionsCount);

        const leaderboard = Object.values(inspectorMap).map((ins: any) => ({
          inspectorName: ins.inspectorName,
          inspectionsCompleted: ins.inspectionsCompleted,
          complianceRate: ins.inspectionsCompleted > 0 ? parseFloat(((ins.compliantCount / ins.inspectionsCompleted) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.inspectionsCompleted - a.inspectionsCompleted).slice(0, 10);

        res.json({
          totalInspections: total,
          complianceRate: total > 0 ? parseFloat(((compliantCount / total) * 100).toFixed(1)) : 0,
          deficientCount,
          averageRating: total > 0 ? parseFloat((ratingSum / total).toFixed(1)) : 0,
          byBuilding,
          leaderboard
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
};

export const listController = {
  // Generic list paginated handler helper
  async handleList(req: Request, res: Response, repo: any, localItems: any[], searchField?: string) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = (req.query.search as string || '').trim();
      const sort = req.query.sort as string || 'createdAt';
      const order = (req.query.order as string || 'desc').toLowerCase() as 'asc' | 'desc';
      
      const filter: any = {};
      const operator = (req as any).user;
      
      // Tenant Isolation check
      if (operator && operator.role !== 'Super Admin') {
        if (localItems === db.users || localItems === db.buildings || localItems === db.assignments) {
          filter.organizationId = operator.organizationId;
        }
      }

      const paginated = await paginate(
        repo,
        localItems,
        filter,
        page,
        limit,
        searchField,
        search,
        sort,
        order
      );
      res.json(paginated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
};

export const backupController = {
  // POST /api/admin/backup
  async createBackup(req: Request, res: Response) {
    try {
      const operator = (req as any).user;
      
      // Complete database JSON backup
      const backupData = {
        users: db.users || [],
        organizations: db.organizations || [],
        buildings: db.buildings || [],
        floors: db.floors || [],
        rooms: db.rooms || [],
        qrCodes: db.qrCodes || [],
        assignments: db.assignments || [],
        inspections: db.inspections || [],
        auditLogs: db.auditLogs || [],
        settings: db.settings || {},
        createdAt: new Date().toISOString(),
        backupId: `bk-${Date.now()}`,
        generatedBy: operator.username
      };

      res.setHeader('Content-disposition', `attachment; filename=cleancheck_backup_${Date.now()}.json`);
      res.setHeader('Content-type', 'application/json');
      res.json(backupData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // POST /api/admin/restore
  async restoreBackup(req: Request, res: Response) {
    try {
      const payload = req.body;
      const operator = (req as any).user;

      if (!operator || operator.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Only Super Admin can restore database state.' });
      }

      // Handle payload wrap ({ confirmRestore: true, data: { ... } } or direct backup object)
      const backup = payload.data || payload;
      const confirmRestore = payload.confirmRestore === true || req.headers['x-confirm-restore'] === 'true' || req.query.confirm === 'true';

      if (!confirmRestore) {
        return res.status(400).json({
          error: 'Safety Confirmation Required: Destructive database restoration requires explicit confirmation.',
          hint: 'Include "confirmRestore": true in the payload or set header X-Confirm-Restore: true to proceed.'
        });
      }

      if (!backup || typeof backup !== 'object') {
        return res.status(400).json({ error: 'Invalid backup file structure' });
      }

      // Basic structure validation
      const requiredKeys = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrCodes', 'assignments', 'inspections', 'settings'];
      const missingKeys = requiredKeys.filter(k => !backup.hasOwnProperty(k));
      if (missingKeys.length > 0) {
        return res.status(400).json({ error: `Validation failed: missing required collections: ${missingKeys.join(', ')}` });
      }

      // Restore executing inside transaction (Phase 10)
      await runInTransaction(async (session) => {
        if (mongoEnabled) {
          // Clear current collections first
          await Promise.all([
            UserModel.deleteMany({}, { session }),
            OrganizationModel.deleteMany({}, { session }),
            BuildingModel.deleteMany({}, { session }),
            FloorModel.deleteMany({}, { session }),
            RoomModel.deleteMany({}, { session }),
            QRCodeModel.deleteMany({}, { session }),
            AssignmentModel.deleteMany({}, { session }),
            InspectionModel.deleteMany({}, { session }),
            AuditLogModel.deleteMany({}, { session }),
            SettingModel.deleteMany({}, { session })
          ]);

          // Perform bulk write or mapping inserts inside Mongoose Session
          const insertPromises = [
            UserModel.insertMany(backup.users.map((u: any) => ({ ...u, _id: u.id })), { session }),
            OrganizationModel.insertMany(backup.organizations.map((o: any) => ({ ...o, _id: o.id })), { session }),
            BuildingModel.insertMany(backup.buildings.map((b: any) => ({ ...b, _id: b.id })), { session }),
            FloorModel.insertMany(backup.floors.map((f: any) => ({ ...f, _id: f.id })), { session }),
            RoomModel.insertMany(backup.rooms.map((r: any) => ({ ...r, _id: r.id })), { session }),
            QRCodeModel.insertMany(backup.qrCodes.map((q: any) => ({ ...q, _id: q.roomId })), { session }),
            AssignmentModel.insertMany(backup.assignments.map((a: any) => ({ ...a, _id: a.id })), { session }),
            InspectionModel.insertMany(backup.inspections.map((i: any) => ({ ...i, _id: i.id })), { session }),
            AuditLogModel.insertMany((backup.auditLogs || []).map((l: any) => ({ ...l, _id: l.id })), { session })
          ];

          if (backup.settings) {
            insertPromises.push(SettingModel.insertMany([{ ...backup.settings, _id: 'global' }], { session }));
          }

          await Promise.all(insertPromises);
        }

        // Apply backup to local database state
        db.users = backup.users;
        db.organizations = backup.organizations;
        db.buildings = backup.buildings;
        db.floors = backup.floors;
        db.rooms = backup.rooms;
        db.qrCodes = backup.qrCodes;
        db.assignments = backup.assignments;
        db.inspections = backup.inspections;
        db.auditLogs = backup.auditLogs || [];
        db.settings = backup.settings || db.settings;

        // Log restoration audit action
        const auditLog: any = {
          id: `aud-restore-${Date.now()}`,
          userId: operator.id,
          username: operator.username,
          action: 'Restore Database Backup',
          details: `Restored entire database state from backup ID: ${backup.backupId || 'untracked'}. Total docs restored: ${backup.users?.length + backup.organizations?.length} records.`,
          createdAt: new Date().toISOString()
        };
        db.auditLogs.unshift(auditLog);

        if (mongoEnabled) {
          const auditDoc = new AuditLogModel({ ...auditLog, _id: auditLog.id });
          await auditDoc.save({ session });
        }

        updateMemoryCache(db);
      });

      res.json({ success: true, message: 'Database state successfully restored and validated.' });
    } catch (error: any) {
      console.error('[RESTORE ERROR] Transaction aborted & state rolled back:', error);
      res.status(500).json({ error: `System restoration failed: ${error.message}. All database states rolled back.` });
    }
  }
};
