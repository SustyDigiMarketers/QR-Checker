import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { JWT } from 'google-auth-library';
import { 
  User, 
  Organization, 
  Building, 
  Floor, 
  Room, 
  Inspection, 
  AppSettings, 
  AuditLog, 
  QrCodeDetails,
  DashboardStats,
  Assignment,
  SyncState,
  SyncQueueItem,
  SyncHealthInfo
} from './src/types.js';
import { 
  organizationService, 
  buildingService, 
  floorService, 
  roomService,
  userService,
  assignmentService,
  inspectionService,
  qrCodeService,
  sessionService
} from './server/services.js';
import { dashboardController, backupController, listController } from './server/controllers.js';
import { saveUploadBuffer, deleteUploadFile, saveBackupSnapshot, isS3Configured, getPresignedReadUrl, getObjectStream } from './server/storage.js';
import {
  validateRequest,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createBuildingSchema,
  updateBuildingSchema,
  createFloorSchema,
  updateFloorSchema,
  createRoomSchema,
  updateRoomSchema,
  createAssignmentSchema,
  createInspectionSchema,
  regenerateQrSchema,
  toggleQrSchema,
  updateSettingsSchema
} from './server/validators.js';
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
} from './models/index.js';

dotenv.config();

const currentFilename = typeof __filename !== 'undefined' ? __filename : (typeof process !== 'undefined' && process.cwd ? path.join(process.cwd(), 'server.ts') : '');
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : (typeof process !== 'undefined' && process.cwd ? process.cwd() : '');

const isProd = process.env.NODE_ENV === 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Firebase Admin with project settings if present
let firestoreEnabled = false;
let firestore: any = null;
let syncState: SyncState = 'CONNECTED';
let lastSyncTime: string | undefined = undefined;
let lastSyncError: string | undefined = undefined;
let firebaseProjectId = '';
let firebaseDatabaseId = '';
let firebaseApiKey = '';

// MongoDB Global State Variables
export let mongoEnabled = false;
export let mongoClient: MongoClient | null = null;
export let mongoDb: any = null;
export let db: any = null;

try {
  console.log('[CleanCheck] Pure MongoDB/Mongoose engine active. Firestore/Firebase integration disabled.');
} catch (e) {
  // Ignored
}

// Generate secure 128-bit random tokens for room QR verification
function generateSecureToken() {
  return 'cc-tok-' + crypto.randomBytes(16).toString('hex');
}

// Generate cryptographically secure salt
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Secure PBKDF2 hashing
function hashPassword(password: string, salt: string, iterations: number = 100000): string {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

// Password policy validator
function validatePasswordStrength(password: string): boolean {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecial;
}

// Session store for active sessions
interface SessionInfo {
  userId: string;
  expiresAt: string;
}
const activeSessions: Record<string, SessionInfo> = {};


// Interface for the entire JSON Database
interface DatabaseSchema {
  users: User[];
  organizations: Organization[];
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  qrCodes: QrCodeDetails[];
  inspections: Inspection[];
  settings: AppSettings;
  auditLogs: AuditLog[];
  assignments?: Assignment[];
  syncQueue?: SyncQueueItem[];
}

// Function to load database with robust seed data
function bootstrapInitialState(): DatabaseSchema {
  // Define original seed data
  const initialDb: DatabaseSchema = {
    assignments: [
      {
        id: 'asg-1',
        inspectorId: 'usr-3',
        inspectorName: 'Joe Miller',
        roomIds: ['rm-1', 'rm-2', 'rm-3'],
        shift: 'Morning',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      },
      {
        id: 'asg-2',
        inspectorId: 'usr-4',
        inspectorName: 'Amy Vance',
        roomIds: ['rm-4', 'rm-5', 'rm-6'],
        shift: 'Afternoon',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      }
    ],
    users: [
      {
        id: 'usr-1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'Super Admin',
        fullName: 'Admin User',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop'
      },
      {
        id: 'usr-2',
        username: 'org_manager',
        email: 'manager@apex.com',
        role: 'Organization Admin',
        fullName: 'Sarah Jenkins',
        organizationId: 'org-1',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop'
      },
      {
        id: 'usr-3',
        username: 'inspector_joe',
        email: 'joe@cleancheck.com',
        role: 'Inspector',
        fullName: 'Joe Miller',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop'
      },
      {
        id: 'usr-4',
        username: 'inspector_amy',
        email: 'amy@cleancheck.com',
        role: 'Inspector',
        fullName: 'Amy Vance',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop'
      }
    ],
    organizations: [
      {
        id: 'org-1',
        name: 'Apex Corporates',
        code: 'APEX',
        active: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        address: '500 Tech Parkway, Suite 100, Silicon Valley',
        contactEmail: 'facility-admin@apex.com'
      },
      {
        id: 'org-2',
        name: 'Omni Healthcare Center',
        code: 'OMNIHC',
        active: true,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        address: '12 Medical Plaza Dr, Chicago',
        contactEmail: 'cleanliness@omnihc.org'
      },
      {
        id: 'org-3',
        name: 'Summit Hospitality Group',
        code: 'SUMMIT',
        active: false,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        address: '88 Alpine Resort Way, Aspen',
        contactEmail: 'quality@summithotels.com'
      }
    ],
    buildings: [
      {
        id: 'bld-1',
        organizationId: 'org-1',
        name: 'HQ West Tower',
        address: '500 Tech Parkway - West Tower',
        createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'bld-2',
        organizationId: 'org-1',
        name: 'HQ East Tower',
        address: '500 Tech Parkway - East Tower',
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'bld-3',
        organizationId: 'org-2',
        name: 'Childrens Clinic Wing',
        address: '12 Medical Plaza Dr - Wing B',
        createdAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    floors: [
      {
        id: 'flr-1',
        buildingId: 'bld-1',
        name: 'Ground Floor',
        level: 0,
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'flr-2',
        buildingId: 'bld-1',
        name: 'First Floor',
        level: 1,
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'flr-3',
        buildingId: 'bld-2',
        name: 'Main Lobby & Atrium',
        level: 0,
        createdAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'flr-4',
        buildingId: 'bld-3',
        name: 'Ground Floor Clinic',
        level: 0,
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'flr-5',
        buildingId: 'bld-3',
        name: 'Second Floor ICU',
        level: 2,
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    rooms: [
      {
        id: 'rm-1',
        floorId: 'flr-1',
        buildingId: 'bld-1',
        name: 'Executive Restroom A',
        type: 'Restroom',
        qrToken: 'qr-exec-restroom-a',
        createdAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rm-2',
        floorId: 'flr-1',
        buildingId: 'bld-1',
        name: 'Kitchenette & Coffee Bar',
        type: 'Kitchen',
        qrToken: 'qr-kitchenette-coffee-bar',
        createdAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rm-3',
        floorId: 'flr-2',
        buildingId: 'bld-1',
        name: 'Conference Center East',
        type: 'Conference',
        qrToken: 'qr-conference-center-east',
        createdAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rm-4',
        floorId: 'flr-3',
        buildingId: 'bld-2',
        name: 'Lobby Public Washroom',
        type: 'Restroom',
        qrToken: 'qr-lobby-public-washroom',
        createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rm-5',
        floorId: 'flr-4',
        buildingId: 'bld-3',
        name: 'Pediatric Waiting Zone',
        type: 'Other',
        qrToken: 'qr-pediatric-waiting-zone',
        createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rm-6',
        floorId: 'flr-5',
        buildingId: 'bld-3',
        name: 'Surgical ICU Restroom',
        type: 'Restroom',
        qrToken: 'qr-surgical-icu-restroom',
        createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    qrCodes: [
      { id: 'rm-1', roomId: 'rm-1', token: 'qr-exec-restroom-a', generatedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 15, status: 'Active' },
      { id: 'rm-2', roomId: 'rm-2', token: 'qr-kitchenette-coffee-bar', generatedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 12, status: 'Active' },
      { id: 'rm-3', roomId: 'rm-3', token: 'qr-conference-center-east', generatedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 8, status: 'Active' },
      { id: 'rm-4', roomId: 'rm-4', token: 'qr-lobby-public-washroom', generatedAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 22, status: 'Active' },
      { id: 'rm-5', roomId: 'rm-5', token: 'qr-pediatric-waiting-zone', generatedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 5, status: 'Active' },
      { id: 'rm-6', roomId: 'rm-6', token: 'qr-surgical-icu-restroom', generatedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), scansCount: 30, status: 'Active' }
    ],
    inspections: [
      // Slew of detailed historical inspections to populate charts instantly!
      {
        id: 'ins-1',
        roomId: 'rm-1',
        roomName: 'Executive Restroom A',
        floorName: 'Ground Floor',
        buildingName: 'HQ West Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-3',
        inspectorName: 'Joe Miller',
        cleaned: true,
        rating: 5,
        remarks: 'Prisinte condition. Fresh paper towels stocked. Mirror polished.',
        deviceTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-2',
        roomId: 'rm-4',
        roomName: 'Lobby Public Washroom',
        floorName: 'Main Lobby & Atrium',
        buildingName: 'HQ East Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-3',
        inspectorName: 'Joe Miller',
        cleaned: false,
        rating: 2,
        remarks: 'Soap dispenser is completely empty and broken. Floor requires sweeping.',
        deviceTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3000).toISOString(),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-3',
        roomId: 'rm-2',
        roomName: 'Kitchenette & Coffee Bar',
        floorName: 'Ground Floor',
        buildingName: 'HQ West Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-4',
        inspectorName: 'Amy Vance',
        cleaned: true,
        rating: 4,
        remarks: 'Sinks wiped down. Espresso tray emptied. Coffee stains scrubbed.',
        deviceTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 4000).toISOString(),
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-4',
        roomId: 'rm-6',
        roomName: 'Surgical ICU Restroom',
        floorName: 'Second Floor ICU',
        buildingName: 'Childrens Clinic Wing',
        organizationName: 'Omni Healthcare Center',
        inspectorId: 'usr-4',
        inspectorName: 'Amy Vance',
        cleaned: true,
        rating: 5,
        remarks: 'Clinical disinfection completed. Deep sanitize report uploaded.',
        deviceTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-5',
        roomId: 'rm-5',
        roomName: 'Pediatric Waiting Zone',
        floorName: 'Ground Floor Clinic',
        buildingName: 'Childrens Clinic Wing',
        organizationName: 'Omni Healthcare Center',
        inspectorId: 'usr-3',
        inspectorName: 'Joe Miller',
        cleaned: true,
        rating: 4,
        remarks: 'Toy bins sanitized. Seating area wiped with anti-bacterial wipes.',
        deviceTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-6',
        roomId: 'rm-1',
        roomName: 'Executive Restroom A',
        floorName: 'Ground Floor',
        buildingName: 'HQ West Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-4',
        inspectorName: 'Amy Vance',
        cleaned: true,
        rating: 5,
        remarks: 'Excellent cleanliness. Stock and sanitization logs up to date.',
        deviceTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        syncedToGoogleSheets: true,
        syncedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 5000).toISOString(),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-7',
        roomId: 'rm-4',
        roomName: 'Lobby Public Washroom',
        floorName: 'Main Lobby & Atrium',
        buildingName: 'HQ East Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-3',
        inspectorName: 'Joe Miller',
        cleaned: true,
        rating: 3,
        remarks: 'Quick sweep and mop. Trash emptied, but odor still remains slightly.',
        deviceTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        syncedToGoogleSheets: false,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ins-8',
        roomId: 'rm-3',
        roomName: 'Conference Center East',
        floorName: 'First Floor',
        buildingName: 'HQ West Tower',
        organizationName: 'Apex Corporates',
        inspectorId: 'usr-4',
        inspectorName: 'Amy Vance',
        cleaned: false,
        rating: 1,
        remarks: 'Trash overflowing after long meeting. Whiteboard not erased, spills on rug.',
        deviceTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        syncedToGoogleSheets: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ],
    settings: {
      googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
      googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || '',
      smtpHost: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      smtpPort: process.env.SMTP_PORT || '587',
      smtpUser: process.env.SMTP_USER || 'apikey',
      companyName: 'CleanCheck Facility Logistics',
      companyLogoUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200&auto=format&fit=crop',
      autoSync: true
    },
    auditLogs: [
      {
        id: 'aud-1',
        userId: 'usr-1',
        username: 'admin',
        action: 'System Bootstrapped',
        details: 'Initial database created with 3 sample organizations, 6 rooms, and baseline history.',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    syncQueue: []
  };

  updateMemoryCache(initialDb);
  return initialDb;
}

db = bootstrapInitialState();

// Save database helper
export function updateMemoryCache(data: DatabaseSchema) {
  // Pure in-memory cache update.
}

const UPLOADS_DIR = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BACKUPS_DIR = process.env.BACKUP_PATH || path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const LOGS_DIR = process.env.LOG_PATH || path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function deleteUploadedFile(url: string | undefined | null) {
  deleteUploadFile(url).catch(err => console.error('[File Cleanup Error]:', err));
}

export function scanFileForMalware(buffer: Buffer): boolean {
  if (buffer.length >= 4) {
    const header = buffer.toString('hex', 0, 4);
    // 4d5a = MZ (EXE), 7f454c46 = ELF, 2321 = #! (Shebang)
    if (header.startsWith('4d5a') || header.startsWith('7f454c46') || header.startsWith('2321')) {
      console.warn('[Heuristic Antivirus Scanner] Executable header detected! Aborting save.');
      return false;
    }
  }
  return true;
}

export function getDirectoryMetrics(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) return { sizeBytes: 0, fileCount: 0 };
    const files = fs.readdirSync(dirPath);
    let sizeBytes = 0;
    let fileCount = 0;
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        sizeBytes += stat.size;
        fileCount++;
      }
    }
    return { sizeBytes, fileCount };
  } catch (err) {
    return { sizeBytes: 0, fileCount: 0, error: String(err) };
  }
}

export async function saveBase64Image(base64Data: string, prefix: string): Promise<string> {
  if (!base64Data) return '';
  // Check if it's actually a base64 data URI
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+.\-_]+);base64,(.+)$/);
  if (!matches) {
    // Already a standard URL (Unsplash or direct asset path)
    return base64Data;
  }

  const ext = (matches[1] === 'jpeg' ? 'jpg' : matches[1]).toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'];
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Upload aborted: Invalid image extension .${ext}. Only standard image types are allowed.`);
  }

  const data = matches[2];
  const buffer = Buffer.from(data, 'base64');
  
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`Upload aborted: File size exceeds the maximum allowed limit of 10MB.`);
  }

  if (!scanFileForMalware(buffer)) {
    throw new Error('Upload aborted: Security scan failed. Suspicious binary/executable content detected.');
  }
  
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return await saveUploadBuffer(buffer, filename, mimeType);
}


async function startServer() {
  const app = express();

  // 1. Configure Security: CORS with an allowlist instead of wildcard origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : ['http://localhost:3000', 'https://localhost:3000', 'http://127.0.0.1:3000'];

  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.trim());
  }
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',').forEach(s => allowedOrigins.push(s.trim()));
  }

  const corsOptions = {
    origin: (origin: string | undefined, callback: any) => {
      // Allow requests without origin (same-origin or direct navigation) or in development
      if (!origin || !isProd) {
        return callback(null, true);
      }
      if (
        allowedOrigins.includes(origin) || 
        origin.endsWith('.run.app') || 
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }
      // If origin is not allowed by policy, disable CORS headers cleanly without throwing a 500 error
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id']
  };
  app.use(cors(corsOptions));

  // 2. Configure Security: Helmet with robust CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Vite dev and inline utilities
            "'unsafe-eval'",   // Vite HMR and dynamic templates
            "https://cdn.jsdelivr.net",
            "https://unpkg.com",
            "https://apis.google.com"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: [
            "'self'", 
            "data:", 
            "blob:", 
            "https://images.unsplash.com", 
            "https://*.googleusercontent.com",
            "https://*.run.app",
            "https://*.onrender.com"
          ],
          connectSrc: [
            "'self'",
            "ws:",
            "wss:",
            "https://*.googleapis.com",
            "https://*.google.com",
            "https://*.run.app",
            "https://*.onrender.com"
          ],
          frameSrc: ["'self'", "https://*.google.com", "https://*.run.app", "https://*.onrender.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Avoid blocking Vite's client-side hot-reload modules
    })
  );

  // Strict Startup Environment Validation (Phase 2)
  const requiredEnvVars = ['MONGODB_URI'];
  const optionalConfigVars = ['JWT_SECRET', 'DOMAIN_NAME', 'APP_URL', 'ALLOWED_ORIGINS', 'UPLOAD_PATH', 'BACKUP_PATH', 'LOG_PATH'];
  
  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│       CLEANCHECK v1.0.0 ENVIRONMENT VERIFICATION       │');
  console.log('├────────────────────────────────────────────────────────┤');
  console.log(`│ NODE_ENV : ${process.env.NODE_ENV || 'development'} (Production is ${isProd})`);
  console.log(`│ PORT     : ${process.env.PORT || '3000'}`);
  
  for (const envVar of requiredEnvVars) {
    const val = process.env[envVar];
    if (val) {
      const masked = val.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.*)/, '$1******$2');
      console.log(`│ 🟩 [REQ] ${envVar.padEnd(14)} : Present (${masked})`);
    } else {
      console.log(`│ 🟥 [REQ] ${envVar.padEnd(14)} : MISSING`);
    }
  }

  for (const envVar of optionalConfigVars) {
    const val = process.env[envVar];
    if (val) {
      const displayVal = envVar === 'JWT_SECRET' ? '******' : val;
      console.log(`│ 🟩 [OPT] ${envVar.padEnd(14)} : Present (${displayVal})`);
    } else {
      console.log(`│ 🟨 [OPT] ${envVar.padEnd(14)} : Not Set (Using fallback/default)`);
    }
  }
  console.log('└────────────────────────────────────────────────────────┘');

  if (isProd) {
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error(`[FATAL ERROR] Missing required environment variables in production: ${missing.join(', ')}`);
      process.exit(1);
    }
  } else {
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.warn(`[WARNING] Missing environment variables: ${missing.join(', ')}. Using local defaults/fallback modes.`);
    }
  }

  // Request ID generator and structured request logger middleware
  app.use((req: any, res: any, next: any) => {
    req.id = crypto.randomBytes(8).toString('hex');
    const startTime = process.hrtime();
    
    res.on('finish', () => {
      const diff = process.hrtime(startTime);
      const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      const userStr = req.user ? `${req.user.username} (${req.user.role})` : 'Anonymous';
      const orgStr = req.user && req.user.organizationId ? req.user.organizationId : 'N/A';
      
      console.log(`[HTTP] ID: ${req.id} | ${req.method} ${req.originalUrl || req.url} | Status: ${res.statusCode} | Latency: ${durationMs}ms | User: ${userStr} | Org: ${orgStr} | IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
    });
    
    next();
  });

  // Serve uploaded images statically
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Authenticated Private Media Proxy for Cloudflare R2 / S3
  app.get('/api/media/uploads/:filename', requireAuth, async (req: any, res: any) => {
    try {
      const filename = req.params.filename;
      if (isS3Configured()) {
        const s3Key = `uploads/${filename}`;
        const presignedUrl = await getPresignedReadUrl(s3Key, 900); // 15 min expiration
        return res.redirect(presignedUrl);
      }

      // Fallback to local storage
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      return res.sendFile(filePath);
    } catch (err: any) {
      console.error('[Media Endpoint Error]:', err.message || err);
      return res.status(500).json({ error: 'Failed to retrieve media file' });
    }
  });

  // Set json body limit to 10MB to easily accommodate image uploads and signatures
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // --- HEALTH MONITORING ENDPOINT ---
  app.get('/api/health', async (req, res) => {
    let mongoConnected = false;
    let collectionsStatus = 'OK';
    let dbLatencyMs = 0;
    
    if (mongoEnabled) {
      try {
        const start = process.hrtime();
        mongoConnected = mongoose.connection.readyState === 1;
        if (mongoConnected && mongoose.connection.db) {
          await mongoose.connection.db.admin().ping();
          const diff = process.hrtime(start);
          dbLatencyMs = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
        } else {
          collectionsStatus = 'Error (Disconnected)';
        }
      } catch (err: any) {
        mongoConnected = false;
        collectionsStatus = `Error: ${err.message || err}`;
      }
    } else {
      mongoConnected = true;
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uploadsMetrics = getDirectoryMetrics(UPLOADS_DIR);
    
    res.status(mongoConnected ? 200 : 503).json({
      status: mongoConnected ? 'UP' : 'DOWN',
      database: {
        engine: mongoEnabled ? 'MongoDB' : 'In-Memory',
        connected: mongoConnected,
        collections: collectionsStatus,
        latencyMs: dbLatencyMs
      },
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      storage: {
        uploads: uploadsMetrics
      }
    });
  });

  // --- TELEMETRY / METRICS ENDPOINT ---
  app.get('/api/metrics', async (req, res) => {
    let mongoConnected = false;
    let dbLatencyMs = 0;
    
    if (mongoEnabled) {
      try {
        const start = process.hrtime();
        mongoConnected = mongoose.connection.readyState === 1;
        if (mongoConnected && mongoose.connection.db) {
          await mongoose.connection.db.admin().ping();
          const diff = process.hrtime(start);
          dbLatencyMs = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
        }
      } catch (err: any) {
        mongoConnected = false;
      }
    } else {
      mongoConnected = true;
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uploadsMetrics = getDirectoryMetrics(UPLOADS_DIR);
    const activeUserCount = db.users ? db.users.length : 0;
    const activeSessionCount = activeSessions ? Object.keys(activeSessions).length : 0;

    res.json({
      timestamp: new Date().toISOString(),
      status: mongoConnected ? 'UP' : 'DOWN',
      metrics: {
        database: {
          engine: mongoEnabled ? 'MongoDB' : 'In-Memory',
          connected: mongoConnected,
          latencyMs: dbLatencyMs
        },
        resources: {
          cpuUserUsage: cpuUsage.user,
          cpuSystemUsage: cpuUsage.system,
          memoryRssBytes: memoryUsage.rss,
          memoryHeapTotalBytes: memoryUsage.heapTotal,
          memoryHeapUsedBytes: memoryUsage.heapUsed,
          memoryExternalBytes: memoryUsage.external,
          uptimeSeconds: process.uptime()
        },
        users: {
          totalUsers: activeUserCount,
          activeSessions: activeSessionCount
        },
        storage: {
          uploadsFileCount: uploadsMetrics.fileCount,
          uploadsSizeBytes: uploadsMetrics.sizeBytes
        }
      }
    });
  });

  // API Versioning Rewrite Middleware: translate /api/v1/* to /api/*
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/v1/')) {
      req.url = '/api/' + req.url.slice(8);
    }
    next();
  });

  // Custom Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https: /uploads/; script-src 'self' 'unsafe-inline' 'unsafe-eval' unpkg.com; style-src 'self' 'unsafe-inline' unpkg.com fonts.googleapis.com; font-src 'self' fonts.gstatic.com unpkg.com; connect-src 'self' https:;");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Custom Rate Limiter for APIs (200 reqs / min)
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  app.use('/api/', (req: any, res: any, next: any) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const limit = 200;
    const windowMs = 60000;

    let rateData = rateLimitMap.get(ip);
    if (!rateData || now > rateData.resetAt) {
      rateData = { count: 0, resetAt: now + windowMs };
    }

    rateData.count++;
    rateLimitMap.set(ip, rateData);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - rateData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateData.resetAt / 1000));

    if (rateData.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  });

  // Global database object loaded on start
  db = bootstrapInitialState();

  // --- MONGODB SYSTEM OF RECORD STATE & SYNCHRONIZATION ---
  function getMongoCollectionName(col: string): string {
    const map: Record<string, string> = {
      users: 'users',
      organizations: 'organizations',
      buildings: 'buildings',
      floors: 'floors',
      rooms: 'rooms',
      qrCodes: 'qrcodes',
      qrcodes: 'qrcodes',
      inspections: 'inspections',
      auditLogs: 'audit_logs',
      audit_logs: 'audit_logs',
      assignments: 'assignments',
      logs: 'logs',
      settings: 'settings',
      sessions: 'sessions',
      activeSessions: 'sessions',
      syncQueue: 'sheet_sync_queue'
    };
    return map[col] || col;
  }

  async function mongoWrite(collectionName: string, docId: string, data: any) {
    if (!mongoEnabled || !mongoDb) return;
    try {
      const mongoCol = getMongoCollectionName(collectionName);
      const doc = { ...data };
      if (!doc.id && doc.roomId) doc.id = doc.roomId;
      doc._id = docId;
      if (!doc.id) doc.id = docId;
      
      await mongoDb.collection(mongoCol).updateOne(
        { _id: docId },
        { $set: doc },
        { upsert: true }
      );
      console.log(`[MongoDB] Written ${collectionName}/${docId} successfully.`);
    } catch (err: any) {
      console.error(`[MongoDB] Failed to write to ${collectionName}/${docId}:`, err.message || err);
    }
  }

  async function mongoDelete(collectionName: string, docId: string) {
    if (!mongoEnabled || !mongoDb) return;
    try {
      const mongoCol = getMongoCollectionName(collectionName);
      await mongoDb.collection(mongoCol).deleteOne({ _id: docId });
      console.log(`[MongoDB] Deleted ${collectionName}/${docId} successfully.`);
    } catch (err: any) {
      console.error(`[MongoDB] Failed to delete ${collectionName}/${docId}:`, err.message || err);
    }
  }

  async function initMongo() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[FATAL ERROR] MONGODB_URI environment variable is missing in production. Failing startup immediately.');
        process.exit(1);
      }
      console.log('[MongoDB] MONGODB_URI is not set. Falling back to in-memory database storage to avoid applet startup crash.');
      return;
    }

    const maxAttempts = 5;
    let attempt = 1;
    let delay = 1000;
    let connected = false;

    const targetDbName = process.env.MONGODB_DB_NAME || 'cleancheck';

    while (attempt <= maxAttempts) {
      try {
        console.log(`[MongoDB] Connecting to database (Attempt ${attempt}/${maxAttempts})...`);
        mongoClient = new MongoClient(uri, {
          connectTimeoutMS: 5000,
          socketTimeoutMS: 30000,
        });
        await mongoClient.connect();

        let dbName = targetDbName;
        try {
          const urlObj = new URL(uri);
          const pathName = urlObj.pathname ? urlObj.pathname.replace(/^\//, '') : '';
          if (pathName && pathName.trim().length > 0) {
            dbName = pathName.trim();
          }
        } catch (_) {
          // Default to targetDbName if URI parsing is relative or standard connection format
        }

        mongoDb = mongoClient.db(dbName);
        await mongoose.connect(uri, { dbName });
        console.log(`[Mongoose] Connected securely to MongoDB database '${dbName}' via Mongoose ODM.`);
        mongoEnabled = true;
        console.log('[MongoDB] Connected securely and established connection pool to MongoDB database.');
        connected = true;
        break;
      } catch (err: any) {
        console.warn(`[MongoDB] Connection attempt ${attempt} failed: ${err.message || err}`);
        if (attempt === maxAttempts) {
          if (process.env.NODE_ENV === 'production') {
            console.error('[FATAL ERROR] MongoDB connection failed after maximum retries in production. Failing startup immediately.', err.message || err);
            process.exit(1);
          }
          console.error('[MongoDB] Initialization error after maximum retries. Running in local in-memory fallback state.', err.message || err);
          return;
        }
        console.log(`[MongoDB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // Exponential backoff
      }
    }

    if (connected && mongoDb) {
      try {
        // Clean up any existing invalid documents with null or missing id in qrcodes
        try {
          await mongoDb.collection('qrcodes').updateMany(
            { $or: [{ id: null }, { id: { $exists: false } }] },
            [{ $set: { id: { $ifNull: ["$roomId", "$_id"] } } }]
          );
        } catch (cleanErr: any) {
          console.warn('[MongoDB Initialization] Note on qrcodes id field repair:', cleanErr.message || cleanErr);
        }

        // Ensure proper validation, indexing, and tenant isolation
        await mongoDb.collection('users').createIndex({ username: 1 }, { unique: true });
        await mongoDb.collection('users').createIndex({ email: 1 });
        await mongoDb.collection('users').createIndex({ organizationId: 1 });
        await mongoDb.collection('organizations').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('organizations').createIndex({ code: 1 }, { unique: true });
        await mongoDb.collection('organizations').createIndex({ name: 1 });
        await mongoDb.collection('buildings').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('buildings').createIndex({ organizationId: 1 });
        await mongoDb.collection('floors').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('floors').createIndex({ buildingId: 1 });
        await mongoDb.collection('rooms').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('rooms').createIndex({ floorId: 1 });
        await mongoDb.collection('qrcodes').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('qrcodes').createIndex({ roomId: 1 }, { unique: true });
        await mongoDb.collection('assignments').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('assignments').createIndex({ inspectorId: 1 });
        await mongoDb.collection('assignments').createIndex({ date: 1 });
        await mongoDb.collection('inspections').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('inspections').createIndex({ roomId: 1 });
        await mongoDb.collection('inspections').createIndex({ inspectorId: 1 });
        await mongoDb.collection('inspections').createIndex({ status: 1 });
        await mongoDb.collection('inspections').createIndex({ createdAt: -1 });
        await mongoDb.collection('inspections').createIndex({ deviceTime: -1 });
        await mongoDb.collection('audit_logs').createIndex({ id: 1 }, { unique: true });
        await mongoDb.collection('audit_logs').createIndex({ userId: 1 });
        await mongoDb.collection('audit_logs').createIndex({ createdAt: -1 });
        await mongoDb.collection('login_sessions').createIndex({ sessionId: 1 });
        await mongoDb.collection('login_sessions').createIndex({ expiresAt: 1 });
        await mongoDb.collection('sheet_sync_queue').createIndex({ inspectionId: 1 });
      } catch (err: any) {
        console.error('[MongoDB] Failed to establish database indexes:', err.message || err);
      }
    }
  }

  async function syncFromMongo() {
    if (!mongoEnabled || !mongoDb) return;

    try {
      console.log("[MongoDB] Syncing operational database on startup...");

      const usersCount = await mongoDb.collection('users').countDocuments();
      if (usersCount === 0) {
        console.log("[MongoDB] Database is empty. Seeding MongoDB with operational defaults...");
        
        const collectionsMap: Record<string, string> = {
          users: 'users',
          organizations: 'organizations',
          buildings: 'buildings',
          floors: 'floors',
          rooms: 'rooms',
          qrCodes: 'qrcodes',
          inspections: 'inspections',
          auditLogs: 'audit_logs',
          assignments: 'assignments'
        };

        for (const [localKey, mongoCol] of Object.entries(collectionsMap)) {
          const items = db[localKey as keyof DatabaseSchema] as any[];
          if (items && items.length > 0) {
            const documents = items.map(item => {
              const doc = { ...item };
              if (!doc.id && doc.roomId) doc.id = doc.roomId;
              if (doc.id) {
                doc._id = doc.id;
              } else if (doc.roomId) {
                doc._id = doc.roomId;
              }
              return doc;
            });
            await mongoDb.collection(mongoCol).insertMany(documents);
          }
        }

        await mongoDb.collection('settings').updateOne(
          { _id: 'global' },
          { $set: { ...db.settings } },
          { upsert: true }
        );

        console.log("[MongoDB] Seeding finished successfully.");
      } else {
        console.log("[MongoDB] Existing cloud datasets found in MongoDB. Loading state...");
        
        const collectionsMap: Record<string, string> = {
          users: 'users',
          organizations: 'organizations',
          buildings: 'buildings',
          floors: 'floors',
          rooms: 'rooms',
          qrCodes: 'qrcodes',
          inspections: 'inspections',
          auditLogs: 'audit_logs',
          assignments: 'assignments',
          syncQueue: 'sheet_sync_queue'
        };

        for (const [localKey, mongoCol] of Object.entries(collectionsMap)) {
          const items = await mongoDb.collection(mongoCol).find({}).toArray();
          const mappedItems = items.map(item => {
            const { _id, ...rest } = item;
            return { id: _id, ...rest };
          });
          
          if (localKey === 'inspections' || localKey === 'auditLogs') {
            mappedItems.sort((a, b) => new Date(b.createdAt || b.deviceTime || 0).getTime() - new Date(a.createdAt || a.deviceTime || 0).getTime());
          }
          (db as any)[localKey] = mappedItems;
        }

        const globalSettings = await mongoDb.collection('settings').findOne({ _id: 'global' });
        if (globalSettings) {
          const { _id, ...rest } = globalSettings;
          db.settings = rest as AppSettings;
        }

        try {
          const sessions = await mongoDb.collection('sessions').find({}).toArray();
          for (const s of sessions) {
            const token = s._id || s.id;
            if (token && s.userId && s.expiresAt) {
              activeSessions[token] = {
                userId: s.userId,
                expiresAt: s.expiresAt
              };
            }
          }
          console.log(`[MongoDB] Loaded ${sessions.length} active sessions into memory tracker.`);
        } catch (e: any) {
          console.warn('[MongoDB] Session synchronization warning:', e.message || e);
        }

        ensureUserPasswords();
        updateMemoryCache(db);
        console.log("[MongoDB] Local state fully synchronized with MongoDB.");
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[FATAL ERROR] Startup synchronization with MongoDB failed in production. Failing startup immediately.', err.message || err);
        process.exit(1);
      }
      console.error("[MongoDB] Initial sync failed, falling back to secure in-memory database:", err.message || err);
    }
  }

  // --- DATABASE HELPERS, ADAPTERS, SCHEMA VALIDATION & AUDIT LOGGING ---
  function matchesQuery(item: any, query: any): boolean {
    for (const [key, val] of Object.entries(query)) {
      if (val && typeof val === 'object' && '$ne' in val) {
        if (item[key] === (val as any).$ne) return false;
      } else if (val && typeof val === 'object' && '$in' in val) {
        if (!(val as any).$in.includes(item[key])) return false;
      } else {
        if (item[key] !== val) return false;
      }
    }
    return true;
  }

  function validateSchema(collection: string, data: any) {
    if (!data) throw new Error('Schema Validation: Data is required.');

    if (collection === 'users') {
      if (!data.username) throw new Error('Schema Validation: username is required.');
      if (!data.email || !data.email.includes('@')) throw new Error('Schema Validation: valid email is required.');
      if (!data.role) throw new Error('Schema Validation: role is required.');
      if (!data.fullName) throw new Error('Schema Validation: fullName is required.');
    } else if (collection === 'organizations') {
      if (!data.name) throw new Error('Schema Validation: name is required.');
      if (!data.code) throw new Error('Schema Validation: code is required.');
    } else if (collection === 'buildings') {
      if (!data.organizationId) throw new Error('Schema Validation: organizationId is required.');
      if (!data.name) throw new Error('Schema Validation: name is required.');
    } else if (collection === 'floors') {
      if (!data.buildingId) throw new Error('Schema Validation: buildingId is required.');
      if (!data.name) throw new Error('Schema Validation: name is required.');
      if (data.level === undefined) throw new Error('Schema Validation: level is required.');
    } else if (collection === 'rooms') {
      if (!data.floorId) throw new Error('Schema Validation: floorId is required.');
      if (!data.buildingId) throw new Error('Schema Validation: buildingId is required.');
      if (!data.name) throw new Error('Schema Validation: name is required.');
      if (!data.type) throw new Error('Schema Validation: type is required.');
    } else if (collection === 'qrCodes' || collection === 'qrcodes') {
      if (!data.roomId) throw new Error('Schema Validation: roomId is required.');
      if (!data.token) throw new Error('Schema Validation: token is required.');
    } else if (collection === 'assignments') {
      if (!data.inspectorId) throw new Error('Schema Validation: inspectorId is required.');
      if (!data.roomIds || !Array.isArray(data.roomIds)) throw new Error('Schema Validation: roomIds array is required.');
      if (!data.shift) throw new Error('Schema Validation: shift is required.');
      if (!data.date) throw new Error('Schema Validation: date is required.');
    } else if (collection === 'inspections') {
      if (!data.roomId) throw new Error('Schema Validation: roomId is required.');
      if (!data.inspectorId) throw new Error('Schema Validation: inspectorId is required.');
      if (data.cleaned === undefined) throw new Error('Schema Validation: cleaned state is required.');
      if (data.rating === undefined || data.rating < 1 || data.rating > 5) throw new Error('Schema Validation: rating (1-5) is required.');
    } else if (collection === 'auditLogs' || collection === 'audit_logs') {
      if (!data.userId) throw new Error('Schema Validation: userId is required.');
      if (!data.username) throw new Error('Schema Validation: username is required.');
      if (!data.action) throw new Error('Schema Validation: action is required.');
    } else if (collection === 'sessions') {
      if (!data.userId) throw new Error('Schema Validation: userId is required.');
      if (!data.expiresAt) throw new Error('Schema Validation: expiresAt is required.');
    } else if (collection === 'settings') {
      if (data.autoSync === undefined) throw new Error('Schema Validation: autoSync is required.');
    }
  }

  function getLocalDbKey(col: string): string {
    const map: Record<string, string> = {
      users: 'users',
      organizations: 'organizations',
      buildings: 'buildings',
      floors: 'floors',
      rooms: 'rooms',
      qrcodes: 'qrCodes',
      qrCodes: 'qrCodes',
      inspections: 'inspections',
      audit_logs: 'auditLogs',
      auditLogs: 'auditLogs',
      assignments: 'assignments',
      logs: 'logs',
      settings: 'settings',
      sessions: 'sessions',
      activeSessions: 'sessions',
      syncQueue: 'syncQueue'
    };
    return map[col] || col;
  }

  async function dbFind(collectionName: string, query: any = {}): Promise<any[]> {
    if (mongoEnabled && mongoDb) {
      const colName = getMongoCollectionName(collectionName);
      return await mongoDb.collection(colName).find(query).toArray();
    } else {
      const localKey = getLocalDbKey(collectionName);
      const items = db[localKey as keyof DatabaseSchema] as any;
      if (!items) return [];
      if (Array.isArray(items)) {
        return items.filter(item => matchesQuery(item, query));
      } else {
        return matchesQuery(items, query) ? [items] : [];
      }
    }
  }

  async function dbFindOne(collectionName: string, query: any = {}): Promise<any | null> {
    if (mongoEnabled && mongoDb) {
      const colName = getMongoCollectionName(collectionName);
      return await mongoDb.collection(colName).findOne(query);
    } else {
      const localKey = getLocalDbKey(collectionName);
      const items = db[localKey as keyof DatabaseSchema] as any;
      if (!items) return null;
      if (Array.isArray(items)) {
        const found = items.find(item => matchesQuery(item, query));
        return found || null;
      } else {
        return matchesQuery(items, query) ? items : null;
      }
    }
  }

  async function dbInsert(collectionName: string, doc: any): Promise<any> {
    validateSchema(collectionName, doc);

    if (mongoEnabled && mongoDb) {
      const colName = getMongoCollectionName(collectionName);
      const mongoDoc = { ...doc };
      if (!mongoDoc.id && mongoDoc.roomId) mongoDoc.id = mongoDoc.roomId;
      if (mongoDoc.id) {
        mongoDoc._id = mongoDoc.id;
      } else if (mongoDoc.roomId) {
        mongoDoc._id = mongoDoc.roomId;
      }
      await mongoDb.collection(colName).insertOne(mongoDoc);
    }
    
    const localKey = getLocalDbKey(collectionName);
    const items = db[localKey as keyof DatabaseSchema] as any;
    if (items) {
      if (Array.isArray(items)) {
        items.push(doc);
        updateMemoryCache(db);
      } else {
        db[localKey as keyof DatabaseSchema] = doc;
        updateMemoryCache(db);
      }
    } else {
      db[localKey as keyof DatabaseSchema] = doc;
      updateMemoryCache(db);
    }
    return doc;
  }

  async function dbUpdate(collectionName: string, id: string, updates: any): Promise<any> {
    if (mongoEnabled && mongoDb) {
      const colName = getMongoCollectionName(collectionName);
      await mongoDb.collection(colName).updateOne({ $or: [{ id }, { _id: id }] }, { $set: updates });
    }

    const localKey = getLocalDbKey(collectionName);
    const items = db[localKey as keyof DatabaseSchema] as any;
    if (items) {
      if (Array.isArray(items)) {
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
          items[index] = { ...items[index], ...updates };
          updateMemoryCache(db);
          return items[index];
        }
      } else {
        const updated = { ...items, ...updates };
        db[localKey as keyof DatabaseSchema] = updated;
        updateMemoryCache(db);
        return updated;
      }
    }
    return null;
  }

  async function dbDelete(collectionName: string, id: string): Promise<boolean> {
    const updates = { isDeleted: true, updatedAt: new Date().toISOString() };
    if (mongoEnabled && mongoDb) {
      const colName = getMongoCollectionName(collectionName);
      await mongoDb.collection(colName).updateOne({ $or: [{ id }, { _id: id }] }, { $set: updates });
    }

    const localKey = getLocalDbKey(collectionName);
    const items = db[localKey as keyof DatabaseSchema] as any;
    if (items) {
      if (Array.isArray(items)) {
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
          items[index] = { ...items[index], ...updates };
          updateMemoryCache(db);
          return true;
        }
      } else {
        const updated = { ...items, ...updates };
        db[localKey as keyof DatabaseSchema] = updated;
        updateMemoryCache(db);
        return true;
      }
    }
    return false;
  }

  async function logSystemEvent(
    type: 'ERROR' | 'API' | 'AUDIT' | 'AUTH' | 'REPORT' | 'SECURITY',
    message: string,
    details: any = null,
    req: any = null
  ) {
    try {
      const logDoc = {
        id: `log-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        type,
        message,
        details: typeof details === 'string' ? details : (details ? JSON.stringify(details) : undefined),
        ipAddress: req ? (req.ip || req.connection?.remoteAddress || 'unknown') : undefined,
        createdAt: new Date().toISOString()
      };

      if (mongoEnabled && mongoDb) {
        await mongoDb.collection('logs').insertOne(logDoc);
      }
      
      if (type === 'AUDIT' && req && req.user) {
        const auditDoc = {
          id: logDoc.id,
          userId: req.user.id,
          username: req.user.username,
          action: message,
          details: typeof details === 'string' ? details : JSON.stringify(details),
          ipAddress: logDoc.ipAddress,
          createdAt: logDoc.createdAt
        };
        await dbInsert('auditLogs', auditDoc);
      }

      console.log(`[SYSTEM LOG][${type}] ${message}`, details || '');
    } catch (err) {
      console.error('Failed to write system log:', err);
    }
  }

  // API Logging Middleware
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logSystemEvent(
        'API',
        `${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`,
        { method: req.method, url: req.originalUrl, statusCode: res.statusCode, duration },
        req
      );
    });
    next();
  });

  // --- INTERACTIVE SWAGGER OPENAPI DOCUMENTATION PAGE ---
  app.get('/api/docs', requireAuth, verifySuperAdminAccess, (req, res) => {
    const openapiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'CleanCheck API Platform',
        version: '1.0.0',
        description: 'CleanCheck Production-Ready 90-Day Pilot REST API documentation. Fully integrated with MongoDB persistence, transactional soft-delete architectures, and multitenant isolation controls.'
      },
      servers: [
        { url: '/api', description: 'Default API gateway relative path' },
        { url: '/api/v1', description: 'Versioned API gateway path' }
      ],
      paths: {
        '/auth/login': {
          post: {
            summary: 'Authenticate User Session',
            description: 'Logs in a user and establishes an active database session token.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['username', 'password'],
                    properties: {
                      username: { type: 'string' },
                      password: { type: 'string' },
                      rememberMe: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: 'Successful login' },
              401: { description: 'Invalid credentials' }
            }
          }
        },
        '/auth/logout': {
          post: {
            summary: 'Invalidate Active Session',
            responses: {
              200: { description: 'Successful logout' }
            }
          }
        },
        '/organizations': {
          get: {
            summary: 'List Organizations',
            responses: { 200: { description: 'List of active organizations' } }
          },
          post: {
            summary: 'Create Organization Atomically',
            responses: { 200: { description: 'Created organization details' } }
          }
        },
        '/organizations/{id}/restore': {
          post: {
            summary: 'Restore Soft-Deleted Organization',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'Organization restored successfully' } }
          }
        },
        '/users/{id}/restore': {
          post: {
            summary: 'Restore Soft-Deleted User',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'User restored successfully' } }
          }
        },
        '/buildings/{id}/restore': {
          post: {
            summary: 'Restore Soft-Deleted Building',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'Building restored successfully' } }
          }
        }
      }
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CleanCheck v1.0.0 API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(openapiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // --- REPORT MODULE DATABASE ENGINE & API (MONGODB BACKED AGGREGATIONS) ---
  app.get('/api/reports', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const operator = req.user;
    const { 
      reportType, 
      organizationId, 
      buildingId, 
      floorId, 
      roomId, 
      inspectorId, 
      status, 
      startDate, 
      endDate, 
      rating,
      qrToken,
      page,
      limit
    } = req.query;

    function sendReportResponse(reportTypeStr: string, dataArray: any[]) {
      logAction(
        operator.id,
        operator.username,
        'Report Download',
        `Generated/Downloaded ${reportTypeStr} report under filter criteria (Org: ${organizationId || operator.organizationId || 'All'}, Building: ${buildingId || 'All'}, Floor: ${floorId || 'All'}, Room: ${roomId || 'All'})`
      );

      const paginated = paginateArray(dataArray, page, limit);
      if (paginated) {
        return res.json({
          reportType: reportTypeStr,
          data: paginated.data,
          pagination: {
            total: paginated.total,
            page: paginated.page,
            limit: paginated.limit,
            totalPages: paginated.totalPages
          }
        });
      }
      return res.json({ reportType: reportTypeStr, data: dataArray });
    }

    let targetOrgId = organizationId;
    if (operator.role === 'Organization Admin') {
      targetOrgId = operator.organizationId;
    }

    // 1. MongoDB Aggregation Execution
    if (mongoEnabled && mongoDb) {
      try {
        const matchQuery: any = { isDeleted: { $ne: true } };

        if (targetOrgId) {
          const bldDocs = await mongoDb.collection('buildings').find({ organizationId: targetOrgId, isDeleted: { $ne: true } }).toArray();
          const bldIds = bldDocs.map(b => b.id);
          const flrDocs = await mongoDb.collection('floors').find({ buildingId: { $in: bldIds }, isDeleted: { $ne: true } }).toArray();
          const flrIds = flrDocs.map(f => f.id);
          const rmDocs = await mongoDb.collection('rooms').find({ floorId: { $in: flrIds }, isDeleted: { $ne: true } }).toArray();
          const rmIds = rmDocs.map(r => r.id);
          matchQuery.roomId = { $in: rmIds };
        }

        if (buildingId) {
          const flrDocs = await mongoDb.collection('floors').find({ buildingId, isDeleted: { $ne: true } }).toArray();
          const flrIds = flrDocs.map(f => f.id);
          const rmDocs = await mongoDb.collection('rooms').find({ floorId: { $in: flrIds }, isDeleted: { $ne: true } }).toArray();
          const rmIds = rmDocs.map(r => r.id);
          matchQuery.roomId = { $in: rmIds };
        }

        if (floorId) {
          const rmDocs = await mongoDb.collection('rooms').find({ floorId, isDeleted: { $ne: true } }).toArray();
          const rmIds = rmDocs.map(r => r.id);
          matchQuery.roomId = { $in: rmIds };
        }

        if (roomId) {
          matchQuery.roomId = roomId;
        }

        if (inspectorId) {
          matchQuery.inspectorId = inspectorId;
        }

        if (status) {
          matchQuery.status = status;
        }

        if (rating) {
          matchQuery.rating = parseInt(rating as string, 10);
        }

        if (startDate || endDate) {
          matchQuery.createdAt = {};
          if (startDate) {
            matchQuery.createdAt.$gte = new Date(startDate as string).toISOString();
          }
          if (endDate) {
            const endD = new Date(endDate as string);
            endD.setHours(23, 59, 59, 999);
            matchQuery.createdAt.$lte = endD.toISOString();
          }
        }

        if (qrToken) {
          const rmDoc = await mongoDb.collection('rooms').findOne({ qrToken, isDeleted: { $ne: true } });
          if (rmDoc) {
            matchQuery.roomId = rmDoc.id;
          } else {
            return sendReportResponse(reportType as string, []);
          }
        }

        switch (reportType) {
          case 'daily': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: { $substr: ["$createdAt", 0, 10] },
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  date: "$_id",
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { date: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'weekly': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: { $substr: ["$createdAt", 0, 10] }, // Simplify to day for week mapping
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              }
            ];
            const rawDays = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            const weeklyMap: Record<string, any> = {};
            rawDays.forEach((day: any) => {
              const d = new Date(day._id);
              const firstDay = new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split('T')[0];
              if (!weeklyMap[firstDay]) {
                weeklyMap[firstDay] = { weekOf: firstDay, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
              }
              weeklyMap[firstDay].total += day.total;
              weeklyMap[firstDay].cleaned += day.cleaned;
              weeklyMap[firstDay].ratingSum += day.ratingSum;
              weeklyMap[firstDay].verified += day.verified;
              weeklyMap[firstDay].rejected += day.rejected;
            });
            const results = Object.values(weeklyMap).map((w: any) => ({
              ...w,
              avgRating: w.total > 0 ? parseFloat((w.ratingSum / w.total).toFixed(1)) : 0,
              cleanRate: w.total > 0 ? parseFloat(((w.cleaned / w.total) * 100).toFixed(1)) : 0
            })).sort((a: any, b: any) => b.weekOf.localeCompare(a.weekOf));
            return sendReportResponse(reportType as string, results);
          }

          case 'monthly': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: { $substr: ["$createdAt", 0, 7] },
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  month: "$_id",
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { month: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'performance': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: "$inspectorId",
                  name: { $first: "$inspectorName" },
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  inspectorId: "$_id",
                  name: { $ifNull: ["$name", "Unknown Inspector"] },
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { total: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'buildings': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: "$buildingName",
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  buildingName: { $ifNull: ["$_id", "Unknown Building"] },
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { total: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'floors': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: { $concat: [{ $ifNull: ["$buildingName", "Unknown"] }, " - ", { $ifNull: ["$floorName", "Unknown"] }] },
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  floorName: "$_id",
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { total: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'rooms': {
            const pipeline = [
              { $match: matchQuery },
              {
                $group: {
                  _id: { $concat: [{ $ifNull: ["$buildingName", "Unknown"] }, " - ", { $ifNull: ["$roomName", "Unknown"] }] },
                  total: { $sum: 1 },
                  cleaned: { $sum: { $cond: ["$cleaned", 1, 0] } },
                  ratingSum: { $sum: "$rating" },
                  verified: { $sum: { $cond: [{ $eq: ["$status", "Verified"] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
                }
              },
              {
                $project: {
                  roomName: "$_id",
                  total: 1,
                  cleaned: 1,
                  ratingSum: 1,
                  verified: 1,
                  rejected: 1,
                  avgRating: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $divide: ["$ratingSum", "$total"] }, 1] }, 0] },
                  cleanRate: { $cond: [{ $gt: ["$total", 0] }, { $round: [{ $multiply: [{ $divide: ["$cleaned", "$total"] }, 100] }, 1] }, 0] }
                }
              },
              { $sort: { total: -1 } }
            ];
            const results = await mongoDb.collection('inspections').aggregate(pipeline).toArray();
            return sendReportResponse(reportType as string, results);
          }

          case 'qr-scans': {
            // Find QR codes and map scans count
            const qrList = await mongoDb.collection('qrcodes').find({ isDeleted: { $ne: true } }).toArray();
            const qrReports: any[] = [];
            for (const qr of qrList) {
              const room = await mongoDb.collection('rooms').findOne({ id: qr.roomId });
              const floor = room ? await mongoDb.collection('floors').findOne({ id: room.floorId }) : null;
              const building = room ? await mongoDb.collection('buildings').findOne({ id: room.buildingId }) : null;

              if (targetOrgId && building && building.organizationId !== targetOrgId) {
                continue;
              }

              const scanCount = await mongoDb.collection('inspections').countDocuments({ roomId: qr.roomId, isDeleted: { $ne: true } });
              qrReports.push({
                roomId: qr.roomId,
                roomName: room ? room.name : 'Unknown Room',
                buildingName: building ? building.name : 'Unknown Building',
                floorName: floor ? floor.name : 'Unknown Floor',
                token: qr.token,
                scansCount: qr.scansCount || scanCount,
                lastScannedAt: qr.lastScannedAt,
                status: qr.status || 'Active'
              });
            }
            return sendReportResponse(reportType as string, qrReports);
          }

          case 'audit-logs': {
            let auditMatch: any = {};
            if (targetOrgId) {
              const usersList = await mongoDb.collection('users').find({ organizationId: targetOrgId }).toArray();
              const userIds = usersList.map(u => u.id);
              auditMatch.userId = { $in: userIds };
            }
            if (startDate || endDate) {
              auditMatch.createdAt = {};
              if (startDate) auditMatch.createdAt.$gte = new Date(startDate as string).toISOString();
              if (endDate) {
                const endD = new Date(endDate as string);
                endD.setHours(23, 59, 59, 999);
                auditMatch.createdAt.$lte = endD.toISOString();
              }
            }
            const logsList = await mongoDb.collection('audit_logs').find(auditMatch).sort({ createdAt: -1 }).toArray();
            return sendReportResponse(reportType as string, logsList);
          }

          case 'inspections':
          default: {
            const inspectionsList = await mongoDb.collection('inspections').find(matchQuery).sort({ createdAt: -1 }).toArray();
            return sendReportResponse('inspections', inspectionsList);
          }
        }
      } catch (err: any) {
        console.error('[MongoDB Aggregation Report Error]', err);
      }
    }

    // 2. FALLBACK IN-MEMORY ARRAY FILTERING & REDUCING
    let filteredInspections = [...db.inspections].filter(i => !i.isDeleted);
    let filteredAuditLogs = [...db.auditLogs];

    if (targetOrgId) {
      const bldIds = db.buildings.filter((b: any) => b.organizationId === targetOrgId).map((b: any) => b.id);
      const flrIds = db.floors.filter((f: any) => bldIds.includes(f.buildingId)).map((f: any) => f.id);
      const rmIds = db.rooms.filter((r: any) => flrIds.includes(r.floorId)).map((r: any) => r.id);
      
      filteredInspections = filteredInspections.filter((i: any) => rmIds.includes(i.roomId));
      const userIds = db.users.filter((u: any) => u.organizationId === targetOrgId).map((u: any) => u.id);
      filteredAuditLogs = filteredAuditLogs.filter((log: any) => userIds.includes(log.userId));
    }

    if (buildingId) {
      const flrIds = db.floors.filter((f: any) => f.buildingId === buildingId).map((f: any) => f.id);
      const rmIds = db.rooms.filter((r: any) => flrIds.includes(r.floorId)).map((r: any) => r.id);
      filteredInspections = filteredInspections.filter((i: any) => rmIds.includes(i.roomId));
    }

    if (floorId) {
      const rmIds = db.rooms.filter((r: any) => r.floorId === floorId).map((r: any) => r.id);
      filteredInspections = filteredInspections.filter((i: any) => rmIds.includes(i.roomId));
    }

    if (roomId) {
      filteredInspections = filteredInspections.filter((i: any) => i.roomId === roomId);
    }

    if (inspectorId) {
      filteredInspections = filteredInspections.filter((i: any) => i.inspectorId === inspectorId);
    }

    if (status) {
      filteredInspections = filteredInspections.filter((i: any) => i.status === status);
    }

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filteredInspections = filteredInspections.filter((i: any) => new Date(i.deviceTime || i.createdAt).getTime() >= startMs);
      filteredAuditLogs = filteredAuditLogs.filter((log: any) => new Date(log.createdAt).getTime() >= startMs);
    }

    if (endDate) {
      const endMs = new Date(endDate).getTime() + 86400000;
      filteredInspections = filteredInspections.filter((i: any) => new Date(i.deviceTime || i.createdAt).getTime() <= endMs);
      filteredAuditLogs = filteredAuditLogs.filter((log: any) => new Date(log.createdAt).getTime() <= endMs);
    }

    if (qrToken) {
      const roomWithToken = db.rooms.find((r: any) => r.qrToken === qrToken);
      if (roomWithToken) {
        filteredInspections = filteredInspections.filter((i: any) => i.roomId === roomWithToken.id);
      } else {
        filteredInspections = [];
      }
    }

    if (rating) {
      const ratingNum = parseInt(rating);
      if (!isNaN(ratingNum)) {
        filteredInspections = filteredInspections.filter((i: any) => i.rating === ratingNum);
      }
    }

    switch (reportType) {
      case 'daily': {
        const dailyMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const dateStr = (i.deviceTime || i.createdAt).split('T')[0];
          if (!dailyMap[dateStr]) {
            dailyMap[dateStr] = { date: dateStr, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          dailyMap[dateStr].total++;
          if (i.cleaned) dailyMap[dateStr].cleaned++;
          dailyMap[dateStr].ratingSum += i.rating || 0;
          if (i.status === 'Verified') dailyMap[dateStr].verified++;
          if (i.status === 'Rejected') dailyMap[dateStr].rejected++;
        });
        const reports = Object.values(dailyMap).map((d: any) => ({
          ...d,
          avgRating: d.total > 0 ? parseFloat((d.ratingSum / d.total).toFixed(1)) : 0,
          cleanRate: d.total > 0 ? parseFloat(((d.cleaned / d.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.date.localeCompare(a.date));
        return sendReportResponse(reportType, reports);
      }

      case 'weekly': {
        const weeklyMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const d = new Date(i.deviceTime || i.createdAt);
          const firstDay = new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split('T')[0];
          if (!weeklyMap[firstDay]) {
            weeklyMap[firstDay] = { weekOf: firstDay, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          weeklyMap[firstDay].total++;
          if (i.cleaned) weeklyMap[firstDay].cleaned++;
          weeklyMap[firstDay].ratingSum += i.rating || 0;
          if (i.status === 'Verified') weeklyMap[firstDay].verified++;
          if (i.status === 'Rejected') weeklyMap[firstDay].rejected++;
        });
        const reports = Object.values(weeklyMap).map((w: any) => ({
          ...w,
          avgRating: w.total > 0 ? parseFloat((w.ratingSum / w.total).toFixed(1)) : 0,
          cleanRate: w.total > 0 ? parseFloat(((w.cleaned / w.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.weekOf.localeCompare(a.weekOf));
        return sendReportResponse(reportType, reports);
      }

      case 'monthly': {
        const monthlyMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const monthStr = (i.deviceTime || i.createdAt).substring(0, 7);
          if (!monthlyMap[monthStr]) {
            monthlyMap[monthStr] = { month: monthStr, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          monthlyMap[monthStr].total++;
          if (i.cleaned) monthlyMap[monthStr].cleaned++;
          monthlyMap[monthStr].ratingSum += i.rating || 0;
          if (i.status === 'Verified') monthlyMap[monthStr].verified++;
          if (i.status === 'Rejected') monthlyMap[monthStr].rejected++;
        });
        const reports = Object.values(monthlyMap).map((m: any) => ({
          ...m,
          avgRating: m.total > 0 ? parseFloat((m.ratingSum / m.total).toFixed(1)) : 0,
          cleanRate: m.total > 0 ? parseFloat(((m.cleaned / m.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.month.localeCompare(a.month));
        return sendReportResponse(reportType, reports);
      }

      case 'performance': {
        const perfMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const key = i.inspectorId || 'unknown';
          if (!perfMap[key]) {
            perfMap[key] = { inspectorId: key, name: i.inspectorName || 'Unknown Inspector', total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          perfMap[key].total++;
          if (i.cleaned) perfMap[key].cleaned++;
          perfMap[key].ratingSum += i.rating || 0;
          if (i.status === 'Verified') perfMap[key].verified++;
          if (i.status === 'Rejected') perfMap[key].rejected++;
        });
        const reports = Object.values(perfMap).map((p: any) => ({
          ...p,
          avgRating: p.total > 0 ? parseFloat((p.ratingSum / p.total).toFixed(1)) : 0,
          cleanRate: p.total > 0 ? parseFloat(((p.cleaned / p.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.total - a.total);
        return sendReportResponse(reportType, reports);
      }

      case 'buildings': {
        const bldMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const bldName = i.buildingName || 'Unknown Building';
          if (!bldMap[bldName]) {
            bldMap[bldName] = { buildingName: bldName, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          bldMap[bldName].total++;
          if (i.cleaned) bldMap[bldName].cleaned++;
          bldMap[bldName].ratingSum += i.rating || 0;
          if (i.status === 'Verified') bldMap[bldName].verified++;
          if (i.status === 'Rejected') bldMap[bldName].rejected++;
        });
        const reports = Object.values(bldMap).map((b: any) => ({
          ...b,
          avgRating: b.total > 0 ? parseFloat((b.ratingSum / b.total).toFixed(1)) : 0,
          cleanRate: b.total > 0 ? parseFloat(((b.cleaned / b.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.total - a.total);
        return sendReportResponse(reportType, reports);
      }

      case 'floors': {
        const flrMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const key = `${i.buildingName || 'Unknown'} - ${i.floorName || 'Unknown'}`;
          if (!flrMap[key]) {
            flrMap[key] = { floorName: key, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          flrMap[key].total++;
          if (i.cleaned) flrMap[key].cleaned++;
          flrMap[key].ratingSum += i.rating || 0;
          if (i.status === 'Verified') flrMap[key].verified++;
          if (i.status === 'Rejected') flrMap[key].rejected++;
        });
        const reports = Object.values(flrMap).map((f: any) => ({
          ...f,
          avgRating: f.total > 0 ? parseFloat((f.ratingSum / f.total).toFixed(1)) : 0,
          cleanRate: f.total > 0 ? parseFloat(((f.cleaned / f.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.total - a.total);
        return sendReportResponse(reportType, reports);
      }

      case 'rooms': {
        const rmMap: Record<string, any> = {};
        filteredInspections.forEach((i: any) => {
          const key = `${i.buildingName || 'Unknown'} - ${i.roomName || 'Unknown'}`;
          if (!rmMap[key]) {
            rmMap[key] = { roomName: key, total: 0, cleaned: 0, ratingSum: 0, verified: 0, rejected: 0 };
          }
          rmMap[key].total++;
          if (i.cleaned) rmMap[key].cleaned++;
          rmMap[key].ratingSum += i.rating || 0;
          if (i.status === 'Verified') rmMap[key].verified++;
          if (i.status === 'Rejected') rmMap[key].rejected++;
        });
        const reports = Object.values(rmMap).map((r: any) => ({
          ...r,
          avgRating: r.total > 0 ? parseFloat((r.ratingSum / r.total).toFixed(1)) : 0,
          cleanRate: r.total > 0 ? parseFloat(((r.cleaned / r.total) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.total - a.total);
        return sendReportResponse(reportType, reports);
      }

      case 'qr-scans': {
        const qrReports = db.qrCodes.map((qr: any) => {
          const room = db.rooms.find((r: any) => r.id === qr.roomId);
          const floor = room ? db.floors.find((f: any) => f.id === room.floorId) : null;
          const building = room ? db.buildings.find((b: any) => b.id === room.buildingId) : null;
          
          if (targetOrgId && building && building.organizationId !== targetOrgId) {
            return null;
          }

          const rmInspections = db.inspections.filter((i: any) => i.roomId === qr.roomId);
          const totalScans = qr.scansCount || rmInspections.length;

          return {
            roomId: qr.roomId,
            roomName: room ? room.name : 'Unknown Room',
            buildingName: building ? building.name : 'Unknown Building',
            floorName: floor ? floor.name : 'Unknown Floor',
            token: qr.token,
            scansCount: totalScans,
            lastScannedAt: qr.lastScannedAt || (rmInspections.length > 0 ? rmInspections[0].createdAt : null),
            status: qr.status || 'Active'
          };
        }).filter(Boolean);

        return sendReportResponse(reportType, qrReports);
      }

      case 'audit-logs': {
        return sendReportResponse(reportType, filteredAuditLogs);
      }

      case 'inspections':
      default: {
        return sendReportResponse('inspections', filteredInspections);
      }
    }
  });

  // Helper to ensure all users have valid passwords and reset lockouts
  function ensureUserPasswords() {
    let upgradedAny = false;
    db.users = db.users.map(u => {
      let changed = false;
      
      // Case 1: Brand new user or user lacking credentials completely (no passwordHash or salt)
      if (!u.passwordHash || !u.salt) {
        const salt = generateSalt();
        u.salt = salt;
        // Default fallback password for initial seed/migrated users is admin1234
        u.passwordHash = hashPassword('admin1234', salt, 100000); // 100,000 iterations for newly generated hashes (Version 2)
        u.passwordVersion = 2;
        u.migrationVersion = 1;
        u.failedLoginAttempts = 0;
        u.lockedUntil = undefined;
        changed = true;
        
        console.log(`[Security] Migrated credentials for ${u.username || u.email} to Version 2 (100k PBKDF2 iterations) with default fallback.`);
        
        // Push an audit log immediately
        const auditId = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLog = {
          id: auditId,
          userId: u.id,
          username: u.username || 'unknown',
          action: 'Credential Migration',
          details: 'Initialized secure credentials (Version 2, 100,000 PBKDF2 iterations) with default password.',
          createdAt: new Date().toISOString()
        };
        db.auditLogs.unshift(newLog);
        if (firestoreEnabled && typeof firestoreWrite === 'function') {
          firestoreWrite('auditLogs', auditId, newLog);
        }
      } 
      // Case 2: User has password credentials but lacks explicit passwordVersion (Legacy Version 1)
      else if (u.passwordVersion === undefined) {
        u.passwordVersion = 1; // Mark them as Version 1 (10,000 iterations)
        u.migrationVersion = 1;
        changed = true;
        console.log(`[Security] Labeled legacy credentials for ${u.username || u.email} as Version 1 (10k PBKDF2 iterations).`);
      }

      if (u.active === undefined) {
        u.active = true;
        changed = true;
      }

      if (changed) {
        upgradedAny = true;
        // If we have active firestore, write the updated user back to cloud Firestore
        if (firestoreEnabled && typeof firestoreWrite === 'function') {
          firestoreWrite('users', u.id, u);
        }
      }
      return u;
    });

    if (upgradedAny) {
      updateMemoryCache(db);
      console.log("[Security] Upgraded user credentials/locked states and synced to local/Firestore database.");
    }
  }

  // Perform initial security and password check
  ensureUserPasswords();

  // Check if SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables are set
  // and update/ensure the super admin user has these credentials
  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
    const adminUser = db.users.find(u => u.role === 'Super Admin');
    if (adminUser) {
      const newEmail = process.env.SUPER_ADMIN_EMAIL;
      const newPassword = process.env.SUPER_ADMIN_PASSWORD;
      
      const currentHash = hashPassword(newPassword, adminUser.salt || '');
      if (adminUser.email !== newEmail || adminUser.passwordHash !== currentHash) {
        adminUser.email = newEmail;
        adminUser.username = newEmail.split('@')[0] || 'admin';
        const salt = generateSalt();
        adminUser.salt = salt;
        adminUser.passwordHash = hashPassword(newPassword, salt);
        adminUser.failedLoginAttempts = 0;
        updateMemoryCache(db);
        if (firestoreEnabled && typeof firestoreWrite === 'function') {
          firestoreWrite('users', adminUser.id, adminUser);
        }
        console.log(`[Security] Updated Super Admin credentials from environment variables: email=${newEmail}`);
      }
    }
  }

  // Repair/recovery: Reset any previously failed queue items so they are retried using the new REST API sync worker
  if (db.syncQueue && db.syncQueue.length > 0) {
    let resetCount = 0;
    for (const item of db.syncQueue) {
      if (item.status === 'FAILED') {
        item.status = 'PENDING';
        item.attempts = 0;
        item.nextRunAt = undefined;
        resetCount++;
      }
    }
    if (resetCount > 0) {
      console.log(`[Firestore Sync] Repaired and reset ${resetCount} failed sync queue items to PENDING for REST sync retry.`);
      updateMemoryCache(db);
    }
  }

// Write and Delete Helpers with Sync Queue and State Machine
  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId?: string | null;
      email?: string | null;
      emailVerified?: boolean | null;
      isAnonymous?: boolean | null;
      tenantId?: string | null;
      providerInfo?: {
        providerId?: string | null;
        email?: string | null;
      }[];
    }
  }

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
    const errMsg = error instanceof Error ? error.message : String(error);
    lastSyncError = errMsg;
    
    if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('Missing or insufficient permissions')) {
      syncState = 'DEGRADED';
      const errInfo: FirestoreErrorInfo = {
        error: errMsg,
        operationType,
        path,
        authInfo: {
          userId: 'system',
          email: 'admin@example.com',
          emailVerified: true,
          isAnonymous: false,
          tenantId: null,
          providerInfo: []
        }
      };
      const jsonStr = JSON.stringify(errInfo);
      console.error('Firestore Error: ', jsonStr);
      throw new Error(jsonStr);
    } else {
      syncState = 'RECOVERING';
      console.warn(`[WARNING] [Firestore Sync] Temporary sync failure during ${operationType} on ${path}: ${errMsg}. Retrying with backoff.`);
      throw error;
    }
  }

  let isFlushing = false;

  function calculateBackoffDelayMs(attempts: number): number {
    if (attempts <= 1) return 30000;      // 30 seconds
    if (attempts === 2) return 60000;     // 1 minute
    if (attempts === 3) return 120000;    // 2 minutes
    if (attempts === 4) return 300000;    // 5 minutes
    if (attempts === 5) return 600000;    // 10 minutes
    return 1800000;                       // 30 minutes (Attempt 6+)
  }

  function toFirestoreValue(val: any): any {
    if (val === null || val === undefined) {
      return { nullValue: null };
    }
    if (typeof val === 'string') {
      return { stringValue: val };
    }
    if (typeof val === 'boolean') {
      return { booleanValue: val };
    }
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        return { integerValue: String(val) };
      }
      return { doubleValue: val };
    }
    if (Array.isArray(val)) {
      return {
        arrayValue: {
          values: val.map(v => toFirestoreValue(v))
        }
      };
    }
    if (typeof val === 'object') {
      return {
        mapValue: {
          fields: toFirestoreFields(val)
        }
      };
    }
    return { stringValue: String(val) };
  }

  function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
    const fields: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        fields[key] = toFirestoreValue(obj[key]);
      }
    }
    return fields;
  }

  function fromFirestoreValue(field: any): any {
    if (!field) return null;
    if ('nullValue' in field) {
      return null;
    }
    if ('stringValue' in field) {
      return field.stringValue;
    }
    if ('booleanValue' in field) {
      return field.booleanValue;
    }
    if ('integerValue' in field) {
      return parseInt(field.integerValue, 10);
    }
    if ('doubleValue' in field) {
      return parseFloat(field.doubleValue);
    }
    if ('arrayValue' in field) {
      const values = field.arrayValue.values || [];
      return values.map((v: any) => fromFirestoreValue(v));
    }
    if ('mapValue' in field) {
      return fromFirestoreFields(field.mapValue.fields || {});
    }
    return null;
  }

  function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const key of Object.keys(fields)) {
      obj[key] = fromFirestoreValue(fields[key]);
    }
    return obj;
  }

  async function flushSyncQueue() {
    if (!firestoreEnabled) {
      syncState = 'CONNECTED';
      return;
    }
    if (isFlushing) return;
    isFlushing = true;

    if (syncState === 'OFFLINE' || syncState === 'DEGRADED') {
      syncState = 'RECOVERING';
    }

    const queue = db.syncQueue || [];
    const now = new Date();

    // Find first eligible item that is not failed and eligible for retry
    const eligibleIndex = queue.findIndex(item => {
      if (item.status === 'FAILED') return false;
      if (!item.nextRunAt) return true;
      return new Date(item.nextRunAt) <= now;
    });

    if (eligibleIndex === -1) {
      // No eligible items right now. Let's see if we have non-failed items pending for future backoffs
      const hasPendingFuture = queue.some(item => item.status === 'PENDING');
      const hasFailed = queue.some(item => item.status === 'FAILED');

      if (queue.length === 0) {
        syncState = 'CONNECTED';
      } else if (hasFailed) {
        syncState = 'DEGRADED';
      } else if (hasPendingFuture) {
        syncState = 'RECOVERING';
      }
      isFlushing = false;
      return;
    }

    const item = queue[eligibleIndex];
    item.status = 'PROCESSING';
    item.attempts = (item.attempts || 0) + 1;
    updateMemoryCache(db);

    try {
      if (item.operation === 'set') {
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/${item.collection}/${item.docId}?key=${firebaseApiKey}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: toFirestoreFields(item.data)
          })
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Firestore REST API Error (set) for ${item.collection}/${item.docId}: ${response.status} ${response.statusText} - ${errText}`);
        }
      } else if (item.operation === 'delete') {
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/${item.collection}/${item.docId}?key=${firebaseApiKey}`;
        const response = await fetch(url, {
          method: 'DELETE'
        });
        if (!response.ok && response.status !== 404) {
          const errText = await response.text();
          throw new Error(`Firestore REST API Error (delete) for ${item.collection}/${item.docId}: ${response.status} ${response.statusText} - ${errText}`);
        }
      }

      // Successfully synchronized! Remove from the persistent queue
      queue.splice(eligibleIndex, 1);
      db.syncQueue = queue;
      updateMemoryCache(db);

      lastSyncTime = new Date().toISOString();
      lastSyncError = undefined;

      // Continue flushing next items if possible
      isFlushing = false;
      setTimeout(() => {
        flushSyncQueue().catch(err => console.error('[Firestore Sync] Chained flush error:', err));
      }, 50);
    } catch (e: any) {
      let finalErrMsg = e instanceof Error ? e.message : String(e);
      try {
        handleFirestoreError(e, item.operation === 'delete' ? OperationType.DELETE : OperationType.WRITE, `${item.collection}/${item.docId}`);
      } catch (formattedErr: any) {
        finalErrMsg = formattedErr.message;
      }

      item.lastError = finalErrMsg;
      lastSyncError = finalErrMsg;

      const isPermissionDenied = finalErrMsg.includes('PERMISSION_DENIED') || finalErrMsg.includes('Missing or insufficient permissions');

      if (item.attempts >= 20 || isPermissionDenied) {
        item.status = 'FAILED';
        syncState = 'DEGRADED';
        console.error(`[CRITICAL] [Firestore Sync] Item ${item.collection}/${item.docId} permanently failed after ${item.attempts} attempts or due to permissions: ${finalErrMsg}`);
        
        logAction(
          'system',
          'sync-worker',
          'Sync Item Failed',
          `Queue item ${item.id} for ${item.collection}/${item.docId} permanently failed. Attempts: ${item.attempts}. Error: ${finalErrMsg}`
        );
      } else {
        item.status = 'PENDING';
        syncState = 'RECOVERING';
        const delayMs = calculateBackoffDelayMs(item.attempts);
        item.nextRunAt = new Date(Date.now() + delayMs).toISOString();
        console.warn(`[WARNING] [Firestore Sync] Sync failed for ${item.collection}/${item.docId}. Delaying next attempt by ${delayMs / 1000}s. Error: ${finalErrMsg}`);
      }

      db.syncQueue = queue;
      updateMemoryCache(db);

      isFlushing = false;
    }
  }

  function firestoreWrite(collectionName: string, docId: string, data: any) {
    if (mongoEnabled) {
      mongoWrite(collectionName, docId, data).catch(err => {
        console.error('[MongoDB] Async write exception:', err);
      });
    }

    if (!firestoreEnabled) return;

    if (!db.syncQueue) db.syncQueue = [];
    // Deduplicate: replace older operations for the same document in the queue
    db.syncQueue = db.syncQueue.filter(item => !(item.collection === collectionName && item.docId === docId));

    db.syncQueue.push({
      id: `sq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      collection: collectionName,
      docId,
      data,
      operation: 'set',
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING'
    });

    updateMemoryCache(db);

    // Run asynchronous flushing
    flushSyncQueue().catch(err => {
      console.error('[Firestore Sync] Async queue flush exception:', err);
    });
  }

  function firestoreDelete(collectionName: string, docId: string) {
    if (mongoEnabled) {
      mongoDelete(collectionName, docId).catch(err => {
        console.error('[MongoDB] Async delete exception:', err);
      });
    }

    if (!firestoreEnabled) return;

    if (!db.syncQueue) db.syncQueue = [];
    // Deduplicate: replace older operations for the same document in the queue
    db.syncQueue = db.syncQueue.filter(item => !(item.collection === collectionName && item.docId === docId));

    db.syncQueue.push({
      id: `sq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      collection: collectionName,
      docId,
      data: null,
      operation: 'delete',
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING'
    });

    updateMemoryCache(db);

    // Run asynchronous flushing
    flushSyncQueue().catch(err => {
      console.error('[Firestore Sync] Async queue flush exception:', err);
    });
  }

  // Connect to MongoDB and synchronize on startup
  await initMongo();
  await syncFromMongo();

  // Sync / Bootstrap local data with Firestore
  if (firestoreEnabled) {
    try {
      console.log("[Firestore] Syncing cloud database on startup...");
      
      let isEmpty = false;
      const usersUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents:runQuery?key=${firebaseApiKey}`;
      const usersRes = await fetch(usersUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            limit: 1
          }
        })
      });
      
      if (usersRes.ok) {
        const results: any = await usersRes.json();
        const docs = Array.isArray(results) ? results.filter(r => r.document) : [];
        if (docs.length === 0) {
          isEmpty = true;
        }
      } else {
        throw new Error(`Failed to query users: ${usersRes.statusText}`);
      }

      if (isEmpty) {
        console.log("[Firestore] Database is empty. Seeding with operational defaults...");
        const collections = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrCodes', 'inspections', 'auditLogs'];
        for (const col of collections) {
          const items = db[col as keyof DatabaseSchema] as any[];
          for (const item of items) {
            const docId = item.id || (item.roomId ? `${item.roomId}-${item.token || 'details'}` : null);
            if (docId) {
              const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/${col}/${docId}?key=${firebaseApiKey}`;
              const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: toFirestoreFields(item) })
              });
              if (!res.ok) {
                throw new Error(`Failed to seed ${col}/${docId}: ${res.statusText}`);
              }
            }
          }
        }
        
        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/global?key=${firebaseApiKey}`;
        const settingsRes = await fetch(settingsUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: toFirestoreFields(db.settings) })
        });
        if (!settingsRes.ok) {
          throw new Error(`Failed to seed settings: ${settingsRes.statusText}`);
        }
        
        console.log("[Firestore] Seeding finished successfully.");
      } else {
        console.log("[Firestore] Existing cloud datasets found. Loading state...");
        const collections = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrCodes', 'inspections', 'auditLogs'];
        for (const col of collections) {
          const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents:runQuery?key=${firebaseApiKey}`;
          const snapshotRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              structuredQuery: {
                from: [{ collectionId: col }]
              }
            })
          });
          const items: any[] = [];
          if (snapshotRes.ok) {
            const results: any = await snapshotRes.json();
            if (Array.isArray(results)) {
              for (const entry of results) {
                if (entry.document && entry.document.fields) {
                  items.push(fromFirestoreFields(entry.document.fields));
                }
              }
            }
          } else {
            throw new Error(`Failed to load ${col}: ${snapshotRes.statusText}`);
          }
          
          if (col === 'inspections' || col === 'auditLogs') {
            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          (db as any)[col] = items;
        }
        
        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/global?key=${firebaseApiKey}`;
        const settingsRes = await fetch(settingsUrl);
        if (settingsRes.ok) {
          const settingsData: any = await settingsRes.json();
          db.settings = fromFirestoreFields(settingsData.fields || {}) as AppSettings;
        }
        
        // Ensure loaded cloud users have valid fallback passwords (e.g. admin1234) and are unlocked on boot
        ensureUserPasswords();

        updateMemoryCache(db);
        console.log("[Firestore] Local state synchronized.");
      }

      // If initial bootstrap succeeded, let's transition to CONNECTED
      syncState = 'CONNECTED';
      lastSyncTime = new Date().toISOString();
      lastSyncError = undefined;

      // Flush any queued items that were not completed during earlier offline periods
      if (db.syncQueue && db.syncQueue.length > 0) {
        console.log(`[Firestore] Found ${db.syncQueue.length} pending operations in local queue. Attempting to flush...`);
        flushSyncQueue().catch(err => console.error('[Firestore Sync] Startup flush error:', err));
      }
    } catch (err: any) {
      console.warn("[Firestore] Initial sync failed, falling back to secure in-memory database:", err.message || err);
      let finalErrMsg = err.message || String(err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (formattedErr: any) {
        finalErrMsg = formattedErr.message;
      }
      lastSyncError = finalErrMsg;
      
      if (err && (err.message || '').includes('PERMISSION_DENIED')) {
        console.warn("[Firestore] Disabling active cloud reads, setting sync status to DEGRADED.");
        syncState = 'DEGRADED';
      } else {
        syncState = 'RECOVERING';
      }
    }
  }

  // Helper: Log audit events
  function logAction(userId: string, username: string, action: string, details: string) {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      userId,
      username,
      action,
      details,
      createdAt: new Date().toISOString()
    };
    db.auditLogs.unshift(newLog); // Prepend to keep latest first
    updateMemoryCache(db);
    firestoreWrite('auditLogs', newLog.id, newLog);
  }

  // Middleware: Authenticate user session
  function requireAuth(req: any, res: any, next: () => void) {
    let userId: string | null = null;
    
    // Check Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = activeSessions[token];
      if (session && new Date(session.expiresAt) > new Date()) {
        userId = session.userId;
        req.sessionToken = token;
      }
    }
    
    // Fallback to query param or body param for backward compatibility
    if (!userId) {
      userId = req.query.userId || req.body.operatorUserId || req.query.operatorUserId || req.body.userId;
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(401).json({ error: 'Session invalid: User not found.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Account deactivated. Access locked.' });
    }
    
    req.user = user;
    next();
  }

  // Helper: Verify if operator has Administrative role permissions
  function verifyAdminAccess(req: any, res: any, next: () => void) {
    if (!req.user) {
      const userId = req.query.userId || req.body.operatorUserId || req.query.operatorUserId || req.body.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(401).json({ error: 'Authentication invalid.' });
      }
      req.user = user;
    }

    if (req.user.role === 'Inspector') {
      return res.status(403).json({ error: 'Access denied: Requires administrator-level privileges.' });
    }
    next();
  }

  // Helper: Verify if operator has Super Admin role permissions
  function verifySuperAdminAccess(req: any, res: any, next: () => void) {
    if (!req.user) {
      const userId = req.query.userId || req.body.operatorUserId || req.query.operatorUserId || req.body.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(401).json({ error: 'Authentication invalid.' });
      }
      req.user = user;
    }

    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Access denied: Requires Super Admin privileges.' });
    }
    next();
  }

  // Helper: Paginate arrays for large tables
  function paginateArray(array: any[], pageStr: any, limitStr: any) {
    if (!pageStr && !limitStr) {
      return null; // Return null if no pagination params specified to preserve raw array response
    }
    const page = parseInt(pageStr as string || '1', 10);
    const limit = parseInt(limitStr as string || '10', 10);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const results = array.slice(startIndex, endIndex);
    return {
      total: array.length,
      page,
      limit,
      totalPages: Math.ceil(array.length / limit),
      data: results
    };
  }

  // --- API ROUTING ENDPOINTS ---

  // Simple rate limiter for login
  const loginAttemptsTracker: Record<string, { count: number; lastAttempt: number }> = {};
  function loginRateLimiter(req: any, res: any, next: () => void) {
    const rawIp = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    const ip = typeof rawIp === 'string' ? rawIp : (Array.isArray(rawIp) ? rawIp[0] : 'unknown-ip');
    const tracker = loginAttemptsTracker[ip];
    const now = Date.now();
    if (tracker) {
      if (tracker.count >= 10 && now - tracker.lastAttempt < 60000) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again in 1 minute.' });
      }
      if (now - tracker.lastAttempt > 60000) {
        tracker.count = 0;
      }
    }
    next();
  }

  // --- SYSTEM HEALTH & SNAPSHOT BACKUP/RESTORE API ---
  app.get('/api/admin/system-health', requireAuth, verifyAdminAccess, async (req: any, res) => {
    try {
      const collections = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrcodes', 'assignments', 'inspections', 'audit_logs', 'logs'];
      const dbStats: Record<string, number> = {};
      let totalSize = 0;

      if (mongoEnabled && mongoDb) {
        for (const col of collections) {
          const colName = getMongoCollectionName(col);
          const count = await mongoDb.collection(colName).countDocuments({});
          dbStats[col] = count;
        }
        try {
          const stats = await mongoDb.command({ dbStats: 1 });
          totalSize = stats.dataSize || stats.storageSize || 0;
        } catch (e) {}
      } else {
        for (const col of collections) {
          const array = db[col as keyof DatabaseSchema] as any[];
          dbStats[col] = array ? array.length : 0;
        }
      }

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      res.json({
        runtimeVersion: process.version,
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        memory: {
          rss: formatBytes(process.memoryUsage().rss),
          heapUsed: formatBytes(process.memoryUsage().heapUsed),
          heapTotal: formatBytes(process.memoryUsage().heapTotal),
        },
        database: {
          enabled: mongoEnabled,
          collectionsCount: collections.length,
          dbSizeHuman: formatBytes(totalSize),
          collections: dbStats
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch health metrics.' });
    }
  });

  app.get('/api/admin/backups', requireAuth, verifyAdminAccess, (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ backups: [] });
      }
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      res.json({ backups: files });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list backups.' });
    }
  });

  app.post('/api/admin/backup', requireAuth, verifyAdminAccess, async (req: any, res) => {
    try {
      const collections = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrcodes', 'assignments', 'inspections', 'audit_logs', 'logs', 'settings'];
      const snapshot: Record<string, any[]> = {};
      
      for (const col of collections) {
        const colName = getMongoCollectionName(col);
        const docs = await dbFind(colName);
        snapshot[col] = docs;
      }

      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.json`;
      fs.writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(snapshot, null, 2), 'utf8');

      await logSystemEvent('AUDIT', `Database backup snapshot created: ${filename}`, { filename }, req);

      res.json({ message: 'Backup created successfully', filename });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create backup snapshot.' });
    }
  });

  app.post('/api/admin/restore', requireAuth, verifyAdminAccess, async (req: any, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      const backupPath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup file not found.' });
      }

      const raw = fs.readFileSync(backupPath, 'utf8');
      const snapshot = JSON.parse(raw);

      for (const [col, docs] of Object.entries(snapshot)) {
        if (!Array.isArray(docs)) continue;
        const colName = getMongoCollectionName(col);
        
        if (mongoEnabled && mongoDb) {
          await mongoDb.collection(colName).deleteMany({});
          if (docs.length > 0) {
            const mongoDocs = docs.map((d: any) => {
              const doc = { ...d };
              if (doc.id) doc._id = doc.id;
              return doc;
            });
            await mongoDb.collection(colName).insertMany(mongoDocs);
          }
        }
        
        if (col === 'audit_logs' || col === 'auditLogs') {
          db.auditLogs = docs;
        } else if (col === 'qrCodes' || col === 'qrcodes') {
          db.qrCodes = docs;
        } else if (col === 'settings') {
          db.settings = docs[0] || db.settings;
        } else if (db[col as keyof DatabaseSchema]) {
          (db as any)[col] = docs;
        }
      }

      updateMemoryCache(db);

      await logSystemEvent('AUDIT', `Database backup snapshot restored: ${filename}`, { filename }, req);

      res.json({ message: 'Database restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore backup snapshot.' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', loginRateLimiter, validateRequest({ body: loginSchema }), async (req, res) => {
    const { username, email, password, rememberMe } = req.body;
    
    // Support both username and email to be fully backwards compatible
    const loginIdentifier = String(email || username || '').trim().toLowerCase();
    const rawIp = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    const ip = typeof rawIp === 'string' ? rawIp : (Array.isArray(rawIp) ? rawIp[0] : 'unknown-ip');
    const userAgent = req.headers['user-agent'] || 'unknown-device';

    // Track attempt on IP
    if (!loginAttemptsTracker[ip]) {
      loginAttemptsTracker[ip] = { count: 0, lastAttempt: Date.now() };
    }
    loginAttemptsTracker[ip].count += 1;
    loginAttemptsTracker[ip].lastAttempt = Date.now();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Email/Username and Password are required.' });
    }

    // Lookup user in memory
    let user = db.users.find(u => 
      (u.email.toLowerCase() === loginIdentifier || 
       u.username.toLowerCase() === loginIdentifier)
    );

    // Fallback lookup in MongoDB if enabled and not in memory
    if (!user && mongoEnabled && mongoDb) {
      try {
        const dbUser = await mongoDb.collection('users').findOne({
          $or: [
            { email: loginIdentifier },
            { username: loginIdentifier }
          ]
        });
        if (dbUser) {
          user = { ...dbUser, id: dbUser.id || dbUser._id };
          const idx = db.users.findIndex(u => u.id === user!.id);
          if (idx !== -1) {
            db.users[idx] = user;
          } else {
            db.users.push(user);
          }
        }
      } catch (mongoErr) {
        console.error('[Login Mongo Fallback Error]', mongoErr);
      }
    }

    // Timing attack prevention: dummy salt/hash comparison if user doesn't exist
    if (!user) {
      const dummySalt = '00000000000000000000000000000000';
      hashPassword(String(password).trim(), dummySalt);
      return res.status(401).json({ error: 'Invalid email, username, or password.' });
    }

    // Account active check
    if (user.active === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact your facility administrator.' });
    }

    // Account lockout check
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const lockRemaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000 / 60);
      return res.status(403).json({ 
        error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${lockRemaining} minute(s).` 
      });
    }

    // Verify Password
    const currentVersion = user.passwordVersion || 1;
    const iterations = currentVersion === 2 ? 100000 : 10000;
    const cleanPassword = String(password).trim();
    const computedHash = hashPassword(cleanPassword, user.salt || '', iterations);
    
    if (computedHash !== user.passwordHash) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        logAction(user.id, user.username, 'Account Locked', `Account temporarily locked after 5 failed login attempts from IP: ${ip}`);
      }

      updateMemoryCache(db);
      firestoreWrite('users', user.id, user);

      logAction(user.id, user.username, 'Failed Login Attempt', `Unsuccessful login attempt from IP: ${ip}`);
      return res.status(401).json({ error: 'Invalid email, username, or password.' });
    }

    // Progressively upgrade user credentials to Version 2 (100k iterations) on successful authentication
    if (currentVersion === 1) {
      const newSalt = generateSalt();
      user.salt = newSalt;
      user.passwordHash = hashPassword(cleanPassword, newSalt, 100000);
      user.passwordVersion = 2;
      user.passwordChangedAt = new Date().toISOString();
      console.log(`[Security] Progressively upgraded user ${user.username} from Version 1 (10k) to Version 2 (100k iterations).`);
      
      // Log migration audit action
      logAction(
        user.id, 
        user.username, 
        'Credential Hardening', 
        'Progressive security upgrade completed successfully. Account credentials hardened to Version 2 (100,000 iterations PBKDF2-SHA512).'
      );
    }

    // Reset lockouts on success
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date().toISOString();
    user.lastLoginIp = String(ip);
    user.lastLoginDevice = userAgent;

    await dbUpdate('users', user.id, user);

    // Generate Session Token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiry = new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000)).toISOString();
    activeSessions[sessionToken] = {
      userId: user.id,
      expiresAt: sessionExpiry
    };
    await dbInsert('sessions', {
      id: sessionToken,
      userId: user.id,
      expiresAt: sessionExpiry,
      createdAt: new Date().toISOString()
    });

    logAction(user.id, user.username, 'User Login', `Successfully logged in via secure email/password auth from IP: ${ip} Device: ${userAgent}`);

    // Exclude hashes from return object
    const { passwordHash, salt, ...safeUser } = user;

    return res.json({ 
      user: safeUser, 
      sessionToken,
      expiresAt: sessionExpiry
    });
  });

  // Auth: Logout
  app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      delete activeSessions[token];
    }
    const { userId } = req.body;
    try {
      if (token) {
        await sessionService.deleteSession(token, userId);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Logout Error]:', error.message || error);
      res.json({ success: true }); // Still return success to clear UI
    }
  });

  // Auth: Logout All Devices
  app.post('/api/auth/logout-all', requireAuth, async (req: any, res) => {
    const userId = req.user.id;
    try {
      // 1. Clear in-memory sessions
      for (const token of Object.keys(activeSessions)) {
        if (activeSessions[token].userId === userId) {
          delete activeSessions[token];
        }
      }
      // 2. Clear database sessions
      await sessionService.deleteUserSessions(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Logout All Devices Error]:', error.message || error);
      res.status(500).json({ error: error.message || 'Failed to logout from all devices.' });
    }
  });

  // Auth: Forgot Password
  app.post('/api/auth/forgot-password', validateRequest({ body: forgotPasswordSchema }), (req, res) => {
    const { email } = req.body;

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const responseMsg = 'If an account is registered with this email, a reset token has been generated.';
    
    if (user) {
      const resetToken = String(Math.floor(100000 + Math.random() * 900000));
      user.lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      console.log(`\n==================================================`);
      console.log(`[SECURITY RESET] PASSWORD RESET REQUESTED`);
      console.log(`User: ${user.fullName} (${user.email})`);
      console.log(`Reset Token/Code: ${resetToken}`);
      console.log(`==================================================\n`);
      
      const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      activeSessions[`reset-${hashedToken}`] = {
        userId: user.id,
        expiresAt: resetExpiry
      };
      dbInsert('sessions', {
        id: `reset-${hashedToken}`,
        userId: user.id,
        expiresAt: resetExpiry,
        createdAt: new Date().toISOString()
      });

      logAction(user.id, user.username, 'Forgot Password Triggered', `Requested password reset token.`);
    }

    res.json({ success: true, message: responseMsg });
  });

  // Auth: Reset Password
  app.post('/api/auth/reset-password', validateRequest({ body: resetPasswordSchema }), (req, res) => {
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const session = activeSessions[`reset-${hashedToken}`];
    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters, contain one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const user = db.users.find(u => u.id === session.userId);
    if (!user) {
      return res.status(400).json({ error: 'User associated with reset token not found.' });
    }

    const salt = generateSalt();
    user.salt = salt;
    user.passwordHash = hashPassword(newPassword, salt, 100000);
    user.passwordVersion = 2;
    user.migrationVersion = 1;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.passwordChangedAt = new Date().toISOString();

    dbUpdate('users', user.id, user);

    delete activeSessions[`reset-${hashedToken}`];
    dbDelete('sessions', `reset-${hashedToken}`);

    logAction(user.id, user.username, 'Password Reset Completed', 'Password successfully reset via secure token verification.');
    res.json({ success: true, message: 'Password successfully updated. You may now log in.' });
  });

  // Auth: Change Password (Internal for authenticated users)
  app.post('/api/auth/change-password', requireAuth, validateRequest({ body: changePasswordSchema }), async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    const cleanCurrent = String(currentPassword).trim();
    const cleanNew = String(newPassword).trim();

    const currentVersion = user.passwordVersion || 1;
    const iterations = currentVersion === 2 ? 100000 : 10000;
    const computedHash = hashPassword(cleanCurrent, user.salt || '', iterations);
    if (computedHash !== user.passwordHash) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    if (!validatePasswordStrength(cleanNew)) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters, contain one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const salt = generateSalt();
    user.salt = salt;
    user.passwordHash = hashPassword(cleanNew, salt, 100000);
    user.passwordVersion = 2;
    user.migrationVersion = 1;
    user.passwordChangedAt = new Date().toISOString();

    await dbUpdate('users', user.id, user);

    logAction(user.id, user.username, 'Password Changed', 'User changed their account password successfully.');
    res.json({ success: true, message: 'Password changed successfully.' });
  });

  // Users lookup (Strict isolation)
  app.get('/api/users', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const user = req.user;
    const { page, limit } = req.query;
    
    let activeUsers: User[] = [];

    if (mongoEnabled && mongoDb) {
      try {
        const query = user.role === 'Super Admin'
          ? { isDeleted: { $ne: true } }
          : { organizationId: user.organizationId, isDeleted: { $ne: true } };
        const mongoUsers = await mongoDb.collection('users').find(query).toArray();
        if (mongoUsers && mongoUsers.length > 0) {
          activeUsers = mongoUsers.map((u: any) => ({ ...u, id: u.id || u._id }));
          mongoUsers.forEach((u: any) => {
            const mapped = { ...u, id: u.id || u._id };
            const idx = db.users.findIndex(x => x.id === mapped.id);
            if (idx !== -1) db.users[idx] = mapped;
            else db.users.push(mapped);
          });
        } else {
          activeUsers = db.users.filter(u => !u.isDeleted);
        }
      } catch (e) {
        activeUsers = db.users.filter(u => !u.isDeleted);
      }
    } else {
      activeUsers = db.users.filter(u => !u.isDeleted);
    }
    
    if (user.role === 'Super Admin') {
      const safeUsers = activeUsers.map(({ passwordHash, salt, ...safe }) => safe);
      const paginated = paginateArray(safeUsers, page, limit);
      return res.json(paginated || safeUsers);
    } else if (user.role === 'Organization Admin') {
      const filtered = activeUsers.filter(u => u.organizationId === user.organizationId);
      const safeUsers = filtered.map(({ passwordHash, salt, ...safe }) => safe);
      const paginated = paginateArray(safeUsers, page, limit);
      return res.json(paginated || safeUsers);
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }
  });

  // Create User
  app.post('/api/users', requireAuth, verifyAdminAccess, validateRequest({ body: createUserSchema }), async (req: any, res) => {
    try {
      const { username, email, fullName, role, organizationId, avatarUrl, password } = req.body;
      const operator = req.user;

      if (!username || !email || !fullName || !role) {
        return res.status(400).json({ error: 'Username, email, full name, and role are required.' });
      }

      if (operator.role === 'Organization Admin') {
        if (role !== 'Inspector') {
          return res.status(403).json({ error: 'Managers (Organization Admins) can only register Inspector accounts.' });
        }
        if (organizationId && organizationId !== operator.organizationId) {
          return res.status(403).json({ error: 'You can only create users in your own organization.' });
        }
      }

      const finalOrgId = operator.role === 'Super Admin' ? (organizationId || undefined) : operator.organizationId;

      const exists = db.users.some(u => 
        u.username.toLowerCase() === username.trim().toLowerCase() || 
        u.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (exists) {
        return res.status(400).json({ error: 'Username or Email is already registered.' });
      }

      let userPassword = password ? String(password).trim() : '';
      if (!userPassword) {
        userPassword = 'Cc-' + crypto.randomBytes(4).toString('hex') + 'A1!';
      } else {
        if (!validatePasswordStrength(userPassword)) {
          return res.status(400).json({ 
            error: 'Password must be at least 8 characters, contain one uppercase letter, one lowercase letter, one number, and one special character.' 
          });
        }
      }

      const salt = generateSalt();
      const hash = hashPassword(userPassword, salt, 100000);

      const newUser: User = {
        id: `usr-${Date.now()}`,
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        active: true,
        organizationId: finalOrgId,
        avatarUrl: avatarUrl || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=100&auto=format&fit=crop`,
        passwordHash: hash,
        salt,
        passwordVersion: 2,
        migrationVersion: 1,
        failedLoginAttempts: 0
      };

      await dbInsert('users', newUser);

      logAction(operator.id, operator.username, 'Create User', `Registered user: ${newUser.username} (${newUser.role}) under Org: ${finalOrgId || 'None'}`);

      const { passwordHash: pHash, salt: uSalt, ...safeUser } = newUser;
      return res.json({ ...safeUser, initialPassword: userPassword });
    } catch (err: any) {
      console.error('Error creating user:', err);
      return res.status(500).json({ error: err.message || 'Failed to create user.' });
    }
  });

  // Update User
  app.put('/api/users/:id', requireAuth, verifyAdminAccess, validateRequest({ body: updateUserSchema }), async (req: any, res) => {
    const { id } = req.params;
    const { email, fullName, role, organizationId, active, avatarUrl, password } = req.body;
    const operator = req.user;

    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser = db.users[userIndex];

    if (operator.role === 'Organization Admin') {
      if (targetUser.organizationId !== operator.organizationId) {
        return res.status(403).json({ error: 'Access denied: Target user belongs to a different organization.' });
      }
      if (targetUser.role !== 'Inspector') {
        return res.status(403).json({ error: 'Managers (Organization Admins) can only modify Inspector accounts.' });
      }
      if (role && role !== 'Inspector') {
        return res.status(403).json({ error: 'Managers (Organization Admins) can only assign the Inspector role.' });
      }
      if (organizationId && organizationId !== operator.organizationId) {
        return res.status(403).json({ error: 'You cannot change a staff member\'s organization.' });
      }
    }

    let hash = targetUser.passwordHash;
    let salt = targetUser.salt;
    let passwordVersion = targetUser.passwordVersion;
    if (password) {
      const cleanPass = String(password).trim();
      if (cleanPass) {
        if (!validatePasswordStrength(cleanPass)) {
          return res.status(400).json({ 
            error: 'Password must be at least 8 characters, contain one uppercase letter, one lowercase letter, one number, and one special character.' 
          });
        }
        salt = generateSalt();
        hash = hashPassword(cleanPass, salt, 100000);
        passwordVersion = 2;
      }
    }

    const updatedUser: User = {
      ...targetUser,
      ...(email !== undefined && { email: email.trim().toLowerCase() }),
      ...(fullName !== undefined && { fullName: fullName.trim() }),
      ...(role !== undefined && ((operator.role === 'Super Admin' || operator.role === 'Organization Admin') ? { role } : {})),
      ...(organizationId !== undefined && (operator.role === 'Super Admin' ? { organizationId: organizationId || undefined } : {})),
      ...(active !== undefined && { active }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      passwordHash: hash,
      salt,
      passwordVersion,
      failedLoginAttempts: 0,
      lockedUntil: undefined
    };

    await dbUpdate('users', id, updatedUser);

    logAction(operator.id, operator.username, 'Update User', `Updated user details for: ${updatedUser.username}`);

    const { passwordHash: pHash, salt: uSalt, ...safeUser } = updatedUser;
    return res.json(safeUser);
  });

  // Delete User
  app.delete('/api/users/:id', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await userService.deleteUser(id, operator);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Delete User Service Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to delete user.' });
    }
  });

  // Restore User
  app.post('/api/users/:id/restore', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await userService.restoreUser(id, operator);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Restore User Service Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to restore user.' });
    }
  });

  // Dashboard Stats
  app.get('/api/dashboard', requireAuth, async (req: any, res) => {
    try {
      const operator = req.user;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weeklyStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthlyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const todayStr = new Date().toISOString().split('T')[0];

      if (mongoEnabled && mongoDb) {
        let orgMatch: any = { isDeleted: { $ne: true } };
        let userMatch: any = { isDeleted: { $ne: true } };
        let bldMatch: any = { isDeleted: { $ne: true } };
        let flrMatch: any = { isDeleted: { $ne: true } };
        let rmMatch: any = { isDeleted: { $ne: true } };
        let inspMatch: any = { isDeleted: { $ne: true } };
        let asgMatch: any = { isDeleted: { $ne: true } };

        if (operator.role === 'Organization Admin') {
          orgMatch.id = operator.organizationId;
          userMatch.organizationId = operator.organizationId;
          bldMatch.organizationId = operator.organizationId;
          
          const blds = await BuildingModel.find({ organizationId: operator.organizationId, isDeleted: { $ne: true } }).select('id').lean();
          const bldIds = blds.map((b: any) => b.id);
          flrMatch.buildingId = { $in: bldIds };
          
          const flrs = await FloorModel.find({ buildingId: { $in: bldIds }, isDeleted: { $ne: true } }).select('id').lean();
          const flrIds = flrs.map((f: any) => f.id);
          rmMatch.floorId = { $in: flrIds };
          
          const rms = await RoomModel.find({ floorId: { $in: flrIds }, isDeleted: { $ne: true } }).select('id').lean();
          const rmIds = rms.map((r: any) => r.id);
          inspMatch.roomId = { $in: rmIds };
          asgMatch.$or = [
            { roomIds: { $in: rmIds } },
            { inspectorId: operator.id }
          ];
        } else if (operator.role === 'Inspector') {
          orgMatch = null;
          bldMatch = null;
          flrMatch = null;
          
          asgMatch.inspectorId = operator.id;
          asgMatch.date = todayStr;
          
          const asgs = await AssignmentModel.find({ inspectorId: operator.id, date: todayStr, isDeleted: { $ne: true } }).lean();
          const assignedRmIds = asgs.flatMap((a: any) => a.roomIds);
          
          rmMatch.id = { $in: assignedRmIds };
          inspMatch.inspectorId = operator.id;
        }

        let totalOrganizations = 0;
        let activeManagersCount = 0;
        let activeInspectorsCount = 0;
        let totalBuildings = 0;
        let totalFloors = 0;
        let totalRooms = 0;

        if (orgMatch) totalOrganizations = await OrganizationModel.countDocuments(orgMatch);
        activeManagersCount = await UserModel.countDocuments({ ...userMatch, role: { $in: ['Organization Admin', 'Manager'] as any }, active: true });
        activeInspectorsCount = await UserModel.countDocuments({ ...userMatch, role: 'Inspector', active: true });
        if (bldMatch) totalBuildings = await BuildingModel.countDocuments(bldMatch);
        if (flrMatch) totalFloors = await FloorModel.countDocuments(flrMatch);
        totalRooms = await RoomModel.countDocuments(rmMatch);

        // Advanced Aggregation pipeline using $facet, $lookup, $group, $project, $sort
        const aggregateResult = await InspectionModel.aggregate([
          { $match: inspMatch },
          {
            $facet: {
              metrics: [
                {
                  $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    todayCount: {
                      $sum: { $cond: [{ $gte: ["$createdAt", todayStart] }, 1, 0] }
                    },
                    weeklyCount: {
                      $sum: { $cond: [{ $gte: ["$createdAt", weeklyStart] }, 1, 0] }
                    },
                    monthlyCount: {
                      $sum: { $cond: [{ $gte: ["$createdAt", monthlyStart] }, 1, 0] }
                    },
                    ratingSum: { $sum: "$rating" },
                    failedCount: {
                      $sum: { $cond: [{ $or: [{ $eq: ["$cleaned", false] }, { $lt: ["$rating", 3] }] }, 1, 0] }
                    },
                    qrScannedSuccess: {
                      $sum: { $cond: [{ $eq: ["$status", "Submitted"] }, 1, 0] }
                    }
                  }
                }
              ],
              recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 10 }
              ]
            }
          }
        ]);

        const metricData = aggregateResult[0]?.metrics[0] || {
          totalCount: 0,
          todayCount: 0,
          weeklyCount: 0,
          monthlyCount: 0,
          ratingSum: 0,
          failedCount: 0,
          qrScannedSuccess: 0
        };

        const todayChecksCount = metricData.todayCount;
        const weeklyAuditsCount = metricData.weeklyCount;
        const monthlyAuditsCount = metricData.monthlyCount;
        const averageRating = metricData.totalCount > 0 ? parseFloat((metricData.ratingSum / metricData.totalCount).toFixed(2)) : 5.0;
        const failedInspectionsCount = metricData.failedCount;
        const qrScanSuccessCount = metricData.qrScannedSuccess;
        const compliancePercentage = metricData.totalCount > 0
          ? parseFloat((((metricData.totalCount - metricData.failedCount) / metricData.totalCount) * 100).toFixed(1))
          : 100.0;

        const recentInspections = (aggregateResult[0]?.recent || []).map((i: any) => ({ ...i, id: i._id || i.id }));

        const todayAssignments = await AssignmentModel.find({ ...asgMatch, date: todayStr }).lean();
        const assignedRoomsSet = new Set<string>();
        todayAssignments.forEach((asg: any) => {
          asg.roomIds?.forEach((rid: string) => assignedRoomsSet.add(rid));
        });
        const assignedInspectionsCount = assignedRoomsSet.size;

        const todayInspectionsDocs = await InspectionModel.find({
          ...inspMatch,
          createdAt: { $gte: todayStart }
        }).select('roomId').lean();
        const todayInspectedRoomIds = new Set(todayInspectionsDocs.map((i: any) => i.roomId));

        let completedAssignedCount = 0;
        assignedRoomsSet.forEach(rid => {
          if (todayInspectedRoomIds.has(rid)) {
            completedAssignedCount++;
          }
        });

        const pendingAssignedCount = assignedInspectionsCount - completedAssignedCount;
        const pendingRoomsCount = Math.max(0, totalRooms - todayChecksCount);

        const stats: DashboardStats = {
          todayChecksCount,
          pendingRoomsCount,
          averageRating,
          failedInspectionsCount,
          totalOrganizations,
          totalBuildings,
          totalFloors,
          totalRooms,
          recentInspections,
          assignedInspectionsCount,
          completedAssignedCount,
          pendingAssignedCount,
          activeManagersCount,
          activeInspectorsCount,
          weeklyAuditsCount,
          monthlyAuditsCount,
          qrScanSuccessCount,
          compliancePercentage,
          syncHealth: {
            status: syncState,
            lastSyncTime,
            queuedCount: db.syncQueue ? db.syncQueue.length : 0,
            failedCount: db.syncQueue ? db.syncQueue.filter((item: any) => item.status === 'FAILED').length : 0,
            oldestQueuedTime: db.syncQueue && db.syncQueue.length > 0 
              ? db.syncQueue.reduce((oldest: any, item: any) => new Date(item.createdAt) < new Date(oldest.createdAt) ? item : oldest).createdAt 
              : undefined,
            lastError: lastSyncError
          }
        };

        return res.json(stats);
      }

      // --- IN-MEMORY/FALLBACK PROCESSOR ---
      let targetBuildings = db.buildings.filter((b: any) => !b.isDeleted);
      let targetFloors = db.floors.filter((f: any) => !f.isDeleted);
      let targetRooms = db.rooms.filter((r: any) => !r.isDeleted);
      let targetInspections = db.inspections.filter((i: any) => !i.isDeleted);
      let targetAssignments = (db.assignments || []).filter((a: any) => !a.isDeleted);
      let targetOrganizations = db.organizations.filter((o: any) => !o.isDeleted);
      let targetUsers = db.users.filter((u: any) => !u.isDeleted);

      if (operator.role === 'Organization Admin') {
        targetOrganizations = targetOrganizations.filter((o: any) => o.id === operator.organizationId);
        targetUsers = targetUsers.filter((u: any) => u.organizationId === operator.organizationId);
        targetBuildings = targetBuildings.filter((b: any) => b.organizationId === operator.organizationId);
        const bldIds = targetBuildings.map((b: any) => b.id);
        targetFloors = targetFloors.filter((f: any) => bldIds.includes(f.buildingId));
        const flrIds = targetFloors.map((f: any) => f.id);
        targetRooms = targetRooms.filter((r: any) => flrIds.includes(r.floorId));
        const rmIds = targetRooms.map((r: any) => r.id);
        targetInspections = targetInspections.filter((i: any) => rmIds.includes(i.roomId));
        targetAssignments = targetAssignments.filter((a: any) => a.roomIds.some((rid: string) => rmIds.includes(rid)));
      } else if (operator.role === 'Inspector') {
        targetOrganizations = [];
        targetUsers = [];
        targetBuildings = [];
        targetFloors = [];
        targetAssignments = targetAssignments.filter((a: any) => a.inspectorId === operator.id && a.date === todayStr);
        const assignedRmIds = new Set<string>();
        targetAssignments.forEach((asg: any) => asg.roomIds?.forEach((rid: string) => assignedRmIds.add(rid)));
        targetRooms = targetRooms.filter((r: any) => assignedRmIds.has(r.id));
        targetInspections = targetInspections.filter((i: any) => i.inspectorId === operator.id);
      }

      const todayInspections = targetInspections.filter((i: any) => new Date(i.createdAt) >= todayStart);
      const weeklyInspections = targetInspections.filter((i: any) => new Date(i.createdAt) >= weeklyStart);
      const monthlyInspections = targetInspections.filter((i: any) => new Date(i.createdAt) >= monthlyStart);

      const failedCount = targetInspections.filter((i: any) => !i.cleaned || i.rating < 3).length;
      const totalRatings = targetInspections.reduce((acc: number, curr: any) => acc + curr.rating, 0);
      const avgRating = targetInspections.length > 0 ? parseFloat((totalRatings / targetInspections.length).toFixed(2)) : 5.0;

      const activeManagersCount = targetUsers.filter((u: any) => ['Organization Admin', 'Manager'].includes(u.role) && u.active).length;
      const activeInspectorsCount = targetUsers.filter((u: any) => u.role === 'Inspector' && u.active).length;

      const todayAssignments = targetAssignments.filter((a: any) => a.date === todayStr);
      const assignedRoomsSet = new Set<string>();
      todayAssignments.forEach((asg: any) => {
        asg.roomIds?.forEach((rid: string) => assignedRoomsSet.add(rid));
      });
      const totalAssignedTodayCount = assignedRoomsSet.size;

      const todayInspectedRoomIds = new Set(todayInspections.map((i: any) => i.roomId));
      let completedAssignedCount = 0;
      assignedRoomsSet.forEach(rid => {
        if (todayInspectedRoomIds.has(rid)) {
          completedAssignedCount++;
        }
      });

      const pendingAssignedCount = totalAssignedTodayCount - completedAssignedCount;
      const compliancePercentage = targetInspections.length > 0
        ? parseFloat((((targetInspections.length - failedCount) / targetInspections.length) * 100).toFixed(1))
        : 100.0;

      const stats: DashboardStats = {
        todayChecksCount: todayInspections.length,
        pendingRoomsCount: Math.max(0, targetRooms.length - todayInspections.length),
        averageRating: avgRating,
        failedInspectionsCount: failedCount,
        totalOrganizations: targetOrganizations.length,
        totalBuildings: targetBuildings.length,
        totalFloors: targetFloors.length,
        totalRooms: targetRooms.length,
        recentInspections: targetInspections.slice(0, 10),
        assignedInspectionsCount: totalAssignedTodayCount,
        completedAssignedCount: completedAssignedCount,
        pendingAssignedCount: pendingAssignedCount,
        activeInspectorsCount,
        activeManagersCount,
        weeklyAuditsCount: weeklyInspections.length,
        monthlyAuditsCount: monthlyInspections.length,
        qrScanSuccessCount: targetInspections.filter((i: any) => i.status === 'Submitted').length,
        compliancePercentage,
        syncHealth: {
          status: syncState,
          lastSyncTime,
          queuedCount: db.syncQueue ? db.syncQueue.length : 0,
          failedCount: db.syncQueue ? db.syncQueue.filter((item: any) => item.status === 'FAILED').length : 0,
          oldestQueuedTime: db.syncQueue && db.syncQueue.length > 0 
            ? db.syncQueue.reduce((oldest: any, item: any) => new Date(item.createdAt) < new Date(oldest.createdAt) ? item : oldest).createdAt 
            : undefined,
          lastError: lastSyncError
        }
      };

      res.json(stats);
    } catch (err: any) {
      console.error('[Dashboard Route Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to compute dashboard stats.' });
    }
  });

  // --- CRUD: ORGANIZATIONS ---
  app.get('/api/organizations', requireAuth, verifyAdminAccess, (req: any, res) => {
    const operator = req.user;
    const { page, limit } = req.query;
    const activeOrgs = db.organizations.filter(o => !o.isDeleted);
    
    if (operator.role === 'Super Admin') {
      const paginated = paginateArray(activeOrgs, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(activeOrgs);
      }
    } else {
      const filtered = activeOrgs.filter(o => o.id === operator.organizationId);
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    }
  });

  app.post('/api/organizations', requireAuth, verifySuperAdminAccess, validateRequest({ body: createOrganizationSchema }), async (req: any, res) => {
    const { name, code, address, contactEmail } = req.body;
    const operator = req.user;

    try {
      const org = await organizationService.createOrganization({ name, code, address, contactEmail }, operator);
      res.json(org);
    } catch (err: any) {
      console.error('[Create Org Transaction Failure] Rolled back successfully:', err);
      res.status(500).json({ error: `Failed to create organization atomically: ${err.message}` });
    }
  });

  app.put('/api/organizations/:id', requireAuth, verifySuperAdminAccess, validateRequest({ body: updateOrganizationSchema }), async (req: any, res) => {
    const { id } = req.params;
    const { name, code, address, contactEmail, active } = req.body;
    const operator = req.user;

    const index = db.organizations.findIndex(o => o.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const updatedOrg = {
      ...db.organizations[index],
      name: name || db.organizations[index].name,
      code: code ? code.toUpperCase() : db.organizations[index].code,
      address: address !== undefined ? address : db.organizations[index].address,
      contactEmail: contactEmail !== undefined ? contactEmail : db.organizations[index].contactEmail,
      active: active !== undefined ? active : db.organizations[index].active
    };

    await dbUpdate('organizations', id, updatedOrg);
    logAction(operator.id, operator.username, 'Update Organization', `Modified organization properties for ID: ${id}`);
    res.json(updatedOrg);
  });

  app.delete('/api/organizations/:id', requireAuth, verifySuperAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await organizationService.deleteOrganization(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Delete Org Transaction Failure] Rolled back successfully:', err);
      res.status(500).json({ error: `Failed to delete organization cascade: ${err.message}` });
    }
  });

  app.post('/api/organizations/:id/restore', requireAuth, verifySuperAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await organizationService.restoreOrganization(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Restore Org Transaction Failure]:', err.message || err);
      res.status(500).json({ error: `Failed to restore organization cascade: ${err.message}` });
    }
  });


  // --- CRUD: BUILDINGS ---
  app.get('/api/buildings', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const operator = req.user;

    if (mongoEnabled && mongoDb) {
      try {
        const query = operator.role === 'Super Admin'
          ? { isDeleted: { $ne: true } }
          : { organizationId: operator.organizationId, isDeleted: { $ne: true } };
        const mongoBlds = await mongoDb.collection('buildings').find(query).toArray();
        if (mongoBlds && mongoBlds.length > 0) {
          const mapped = mongoBlds.map((b: any) => ({ ...b, id: b.id || b._id }));
          mongoBlds.forEach((b: any) => {
            const item = { ...b, id: b.id || b._id };
            const idx = db.buildings.findIndex(x => x.id === item.id);
            if (idx !== -1) db.buildings[idx] = item;
            else db.buildings.push(item);
          });
          return res.json(mapped);
        }
      } catch (err) {
        console.error('[GET /api/buildings Mongo error]', err);
      }
    }

    const activeBuildings = db.buildings.filter(b => !b.isDeleted);
    if (operator.role === 'Super Admin') {
      return res.json(activeBuildings);
    } else {
      const filtered = activeBuildings.filter(b => b.organizationId === operator.organizationId);
      return res.json(filtered);
    }
  });

  app.post('/api/buildings', requireAuth, verifySuperAdminAccess, validateRequest({ body: createBuildingSchema }), async (req: any, res) => {
    const { organizationId, name, address } = req.body;
    const operator = req.user;

    const newBuilding: Building = {
      id: `bld-${Date.now()}`,
      organizationId,
      name,
      address,
      createdAt: new Date().toISOString()
    };

    await dbInsert('buildings', newBuilding);
    logAction(operator.id, operator.username, 'Create Building', `Created building ${name}`);
    return res.json(newBuilding);
  });

  app.put('/api/buildings/:id', requireAuth, verifySuperAdminAccess, validateRequest({ body: updateBuildingSchema }), async (req: any, res) => {
    const { id } = req.params;
    const { organizationId, name, address } = req.body;
    const operator = req.user;

    const index = db.buildings.findIndex(b => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const updatedBld = {
      ...db.buildings[index],
      organizationId: organizationId || db.buildings[index].organizationId,
      name: name || db.buildings[index].name,
      address: address !== undefined ? address : db.buildings[index].address
    };

    await dbUpdate('buildings', id, updatedBld);
    logAction(operator.id, operator.username, 'Update Building', `Updated building properties for ID: ${id}`);
    return res.json(updatedBld);
  });

  app.delete('/api/buildings/:id', requireAuth, verifySuperAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await buildingService.deleteBuilding(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Delete Building Transaction Failure] Rolled back successfully:', err);
      res.status(500).json({ error: `Failed to delete building cascade: ${err.message}` });
    }
  });

  app.post('/api/buildings/:id/restore', requireAuth, verifySuperAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await buildingService.restoreBuilding(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Restore Building Transaction Failure]:', err.message || err);
      res.status(500).json({ error: `Failed to restore building cascade: ${err.message}` });
    }
  });


  // --- CRUD: FLOORS ---
  app.get('/api/floors', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const operator = req.user;

    if (mongoEnabled && mongoDb) {
      try {
        let docs: any[] = [];
        if (operator.role === 'Super Admin') {
          docs = await mongoDb.collection('floors').find({ isDeleted: { $ne: true } }).toArray();
        } else {
          const bldDocs = await mongoDb.collection('buildings').find({ organizationId: operator.organizationId, isDeleted: { $ne: true } }).toArray();
          const bldIds = bldDocs.map((b: any) => b.id || b._id);
          docs = await mongoDb.collection('floors').find({ buildingId: { $in: bldIds }, isDeleted: { $ne: true } }).toArray();
        }
        if (docs && docs.length > 0) {
          const mapped = docs.map((f: any) => ({ ...f, id: f.id || f._id }));
          docs.forEach((f: any) => {
            const item = { ...f, id: f.id || f._id };
            const idx = db.floors.findIndex(x => x.id === item.id);
            if (idx !== -1) db.floors[idx] = item;
            else db.floors.push(item);
          });
          return res.json(mapped);
        }
      } catch (err) {
        console.error('[GET /api/floors Mongo error]', err);
      }
    }

    const activeFloors = db.floors.filter(f => !f.isDeleted);
    const activeBuildings = db.buildings.filter(b => !b.isDeleted);
    
    if (operator.role === 'Super Admin') {
      return res.json(activeFloors);
    } else {
      const myBuildings = activeBuildings.filter(b => b.organizationId === operator.organizationId).map(b => b.id);
      const filtered = activeFloors.filter(f => myBuildings.includes(f.buildingId));
      return res.json(filtered);
    }
  });

  app.post('/api/floors', requireAuth, verifyAdminAccess, validateRequest({ body: createFloorSchema }), async (req: any, res) => {
    const { buildingId, name, level } = req.body;
    const operator = req.user;

    const building = db.buildings.find(b => b.id === buildingId);
    if (!building) {
      return res.status(404).json({ error: 'Associated building not found.' });
    }

    if (operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
      return res.status(403).json({ error: 'Access denied: Target building belongs to a different organization.' });
    }

    const newFloor: Floor = {
      id: `flr-${Date.now()}`,
      buildingId,
      name,
      level: parseInt(level || '0', 10),
      createdAt: new Date().toISOString()
    };

    await dbInsert('floors', newFloor);
    logAction(operator.id, operator.username, 'Create Floor', `Created floor level ${name}`);
    return res.json(newFloor);
  });

  app.put('/api/floors/:id', requireAuth, verifyAdminAccess, validateRequest({ body: updateFloorSchema }), async (req: any, res) => {
    const { id } = req.params;
    const { buildingId, name, level } = req.body;
    const operator = req.user;

    const index = db.floors.findIndex(f => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const targetFloor = db.floors[index];
    const currentBuilding = db.buildings.find(b => b.id === targetFloor.buildingId);
    
    if (operator.role === 'Organization Admin') {
      if (currentBuilding && currentBuilding.organizationId !== operator.organizationId) {
        return res.status(403).json({ error: 'Access denied: Target floor belongs to a different organization.' });
      }
    }

    const updatedFlr = {
      ...db.floors[index],
      buildingId: buildingId || db.floors[index].buildingId,
      name: name || db.floors[index].name,
      level: level !== undefined ? parseInt(level, 10) : db.floors[index].level
    };

    await dbUpdate('floors', id, updatedFlr);
    logAction(operator.id, operator.username, 'Update Floor', `Updated floor level parameters for ID: ${id}`);
    return res.json(updatedFlr);
  });

  app.delete('/api/floors/:id', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    const index = db.floors.findIndex(f => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const targetFloor = db.floors[index];
    const building = db.buildings.find(b => b.id === targetFloor.buildingId);

    if (operator.role === 'Organization Admin' && building && building.organizationId !== operator.organizationId) {
      return res.status(403).json({ error: 'Access denied: Target floor belongs to a different organization.' });
    }

    try {
      await floorService.deleteFloor(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Delete Floor Transaction Failure] Rolled back successfully:', err);
      res.status(500).json({ error: `Failed to delete floor cascade: ${err.message}` });
    }
  });


  // --- CRUD: ROOMS & QR ASSIGNMENT ---
  app.get('/api/rooms', requireAuth, async (req: any, res) => {
    const operator = req.user;

    if (mongoEnabled && mongoDb) {
      try {
        let docs: any[] = [];
        if (operator.role === 'Super Admin') {
          docs = await mongoDb.collection('rooms').find({ isDeleted: { $ne: true } }).toArray();
        } else if (operator.role === 'Organization Admin') {
          const bldDocs = await mongoDb.collection('buildings').find({ organizationId: operator.organizationId, isDeleted: { $ne: true } }).toArray();
          const bldIds = bldDocs.map((b: any) => b.id || b._id);
          const flrDocs = await mongoDb.collection('floors').find({ buildingId: { $in: bldIds }, isDeleted: { $ne: true } }).toArray();
          const flrIds = flrDocs.map((f: any) => f.id || f._id);
          docs = await mongoDb.collection('rooms').find({ floorId: { $in: flrIds }, isDeleted: { $ne: true } }).toArray();
        } else {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayAssignments = (db.assignments || []).filter(a => a.inspectorId === operator.id && a.date === todayStr);
          const assignedRmIds = new Set<string>();
          todayAssignments.forEach(asg => asg.roomIds.forEach(rid => assignedRmIds.add(rid)));
          docs = await mongoDb.collection('rooms').find({ id: { $in: Array.from(assignedRmIds) }, isDeleted: { $ne: true } }).toArray();
        }
        if (docs && docs.length > 0) {
          const mapped = docs.map((r: any) => ({ ...r, id: r.id || r._id }));
          docs.forEach((r: any) => {
            const item = { ...r, id: r.id || r._id };
            const idx = db.rooms.findIndex(x => x.id === item.id);
            if (idx !== -1) db.rooms[idx] = item;
            else db.rooms.push(item);
          });
          return res.json(mapped);
        }
      } catch (err) {
        console.error('[GET /api/rooms Mongo error]', err);
      }
    }

    const activeRooms = db.rooms.filter(r => !r.isDeleted);
    const activeBuildings = db.buildings.filter(b => !b.isDeleted);
    const activeFloors = db.floors.filter(f => !f.isDeleted);
    
    if (operator.role === 'Super Admin') {
      return res.json(activeRooms);
    } else if (operator.role === 'Organization Admin') {
      const myBuildings = activeBuildings.filter(b => b.organizationId === operator.organizationId).map(b => b.id);
      const myFloors = activeFloors.filter(f => myBuildings.includes(f.buildingId)).map(f => f.id);
      const filtered = activeRooms.filter(r => myFloors.includes(r.floorId));
      return res.json(filtered);
    } else {
      // Inspectors only see their assigned rooms for today
      const todayStr = new Date().toISOString().split('T')[0];
      const todayAssignments = (db.assignments || []).filter(a => a.inspectorId === operator.id && a.date === todayStr);
      const assignedRmIds = new Set<string>();
      todayAssignments.forEach(asg => asg.roomIds.forEach(rid => assignedRmIds.add(rid)));
      const filtered = activeRooms.filter(r => assignedRmIds.has(r.id));
      return res.json(filtered);
    }
  });

  app.post('/api/rooms', requireAuth, verifyAdminAccess, validateRequest({ body: createRoomSchema }), async (req: any, res) => {
    try {
      const { floorId, buildingId, name, type } = req.body;
      const operator = req.user;

      let targetBuildingId = buildingId;
      if (!targetBuildingId && floorId) {
        const floor = db.floors.find(f => f.id === floorId);
        if (floor) {
          targetBuildingId = floor.buildingId;
        }
      }

      // Verify building ownership if building is present
      if (targetBuildingId) {
        const building = db.buildings.find(b => b.id === targetBuildingId);
        if (building && operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
          return res.status(403).json({ error: 'Access denied: Target building belongs to a different organization.' });
        }
      }

      const floor = db.floors.find(f => f.id === floorId);
      if (!floor) {
        return res.status(404).json({ error: 'Associated floor not found.' });
      }

      if (!targetBuildingId) {
        targetBuildingId = floor.buildingId;
      }

      const roomId = `rm-${crypto.randomBytes(8).toString('hex')}`;
      const token = generateSecureToken();

      const newRoom: Room = {
        id: roomId,
        floorId,
        buildingId: targetBuildingId,
        name,
        type,
        qrToken: token,
        createdAt: new Date().toISOString()
      };

      const newQr: QrCodeDetails = {
        id: roomId,
        roomId,
        token,
        generatedAt: new Date().toISOString(),
        scansCount: 0,
        status: 'Active'
      };

      await dbInsert('rooms', newRoom);
      await dbInsert('qrCodes', newQr);

      logAction(operator.id, operator.username, 'Create Room & QR Code', `Created room ${name} & mapped secure QR Token: ${token}`);
      return res.json(newRoom);
    } catch (err: any) {
      console.error('Error creating room:', err);
      return res.status(500).json({ error: err.message || 'Failed to create room.' });
    }
  });

  app.put('/api/rooms/:id', requireAuth, verifyAdminAccess, validateRequest({ body: updateRoomSchema }), async (req: any, res) => {
    const { id } = req.params;
    const { name, type, floorId, buildingId } = req.body;
    const operator = req.user;

    const index = db.rooms.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const targetRoom = db.rooms[index];

    // Verify ownership
    const building = db.buildings.find(b => b.id === targetRoom.buildingId);
    if (building && operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
      return res.status(403).json({ error: 'Access denied: Room belongs to a different organization.' });
    }

    const updatedRm = {
      ...db.rooms[index],
      name: name || db.rooms[index].name,
      type: type || db.rooms[index].type,
      floorId: floorId || db.rooms[index].floorId,
      buildingId: buildingId || db.rooms[index].buildingId
    };

    await dbUpdate('rooms', id, updatedRm);
    logAction(operator.id, operator.username, 'Update Room', `Updated parameters for Room ID: ${id}`);
    return res.json(updatedRm);
  });

  app.delete('/api/rooms/:id', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    const index = db.rooms.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const targetRoom = db.rooms[index];

    // Verify ownership
    const building = db.buildings.find(b => b.id === targetRoom.buildingId);
    if (building && operator.role === 'Organization Admin' && building.organizationId !== operator.organizationId) {
      return res.status(403).json({ error: 'Access denied: Room belongs to a different organization.' });
    }

    try {
      await roomService.deleteRoom(id, operator);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Delete Room Transaction Failure] Rolled back successfully:', err);
      res.status(500).json({ error: `Failed to delete room cascade: ${err.message}` });
    }
  });


  // --- QR CODES MANAGEMENT ---
  app.get('/api/qr-codes', requireAuth, verifyAdminAccess, (req: any, res) => {
    const operator = req.user;
    const activeQrCodes = db.qrCodes.filter(q => !q.isDeleted);
    
    if (operator.role === 'Super Admin') {
      res.json(activeQrCodes);
    } else {
      const myBuildings = db.buildings.filter(b => !b.isDeleted && b.organizationId === operator.organizationId).map(b => b.id);
      const myFloors = db.floors.filter(f => !f.isDeleted && myBuildings.includes(f.buildingId)).map(f => f.id);
      const myRooms = db.rooms.filter(r => !r.isDeleted && myFloors.includes(r.floorId)).map(r => r.id);
      const filtered = activeQrCodes.filter(q => myRooms.includes(q.roomId));
      res.json(filtered);
    }
  });

  // Regenerate/refresh Token for security purposes
  app.post('/api/qr-codes/regenerate', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { roomId } = req.body;
    const operator = req.user;

    const newToken = generateSecureToken();

    try {
      const updatedQr = await qrCodeService.regenerateQR(roomId, newToken, operator);
      res.json(updatedQr);
    } catch (error: any) {
      console.error('[Regenerate QR Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to regenerate QR.' });
    }
  });

  // Toggle QR Code active status
  app.post('/api/qr-codes/toggle', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { roomId } = req.body;
    const operator = req.user;

    try {
      const updatedQr = await qrCodeService.toggleQR(roomId, operator);
      res.json(updatedQr);
    } catch (error: any) {
      console.error('[Toggle QR Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to toggle QR status.' });
    }
  });


  // --- SCAN QR: VALIDATE TOKEN ---
  app.get('/api/scan/:token', (req, res) => {
    const { token } = req.params;
    const { userId } = req.query;

    const room = db.rooms.find(r => r.qrToken === token);
    if (!room) {
      return res.status(404).json({ error: 'Invalid or broken QR Code token. Please contact facility admin.' });
    }

    const qrCode = db.qrCodes.find(q => q.roomId === room.id);
    if (qrCode && qrCode.status === 'Disabled') {
      return res.status(403).json({ error: 'This QR code token has been disabled by management.' });
    }

    const floor = db.floors.find(f => f.id === room.floorId);
    const building = db.buildings.find(b => b.id === room.buildingId);
    const org = building ? db.organizations.find(o => o.id === building.organizationId) : null;

    if (org && !org.active) {
      return res.status(403).json({ error: `Organization "${org.name}" is currently set to Inactive. Inspections are locked.` });
    }

    if (userId) {
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(401).json({ error: 'User is not authenticated.' });
      }

      // Check organization alignment for security
      if (user.role !== 'Super Admin' && building && building.organizationId !== user.organizationId) {
        return res.status(403).json({ error: '❌ Access denied: This room belongs to a different organization.' });
      }

      if (user.role === 'Inspector') {
        const todayStr = new Date().toISOString().split('T')[0];
        const inspectorAssignments = (db.assignments || []).filter(a => a.inspectorId === userId && a.date === todayStr);
        
        if (inspectorAssignments.length === 0) {
          return res.status(403).json({ error: '❌ No shifts or assignments scheduled for you today. Please contact your supervisor.' });
        }

        const isAssigned = inspectorAssignments.some(a => a.roomIds.includes(room.id));
        if (!isAssigned) {
          return res.status(403).json({ error: '❌ This room is not assigned to you. Please contact your supervisor.' });
        }
      }
    }

    if (qrCode) {
      qrCode.scansCount += 1;
      qrCode.lastScannedAt = new Date().toISOString();
      dbUpdate('qrCodes', room.id, qrCode);
    }

    res.json({
      room,
      floorName: floor ? floor.name : 'Unknown Floor',
      buildingName: building ? building.name : 'Unknown Building',
      organizationName: org ? org.name : 'Unknown Organization'
    });
  });


  // --- INSPECTIONS CONTROLLER ---
  app.get('/api/inspections', requireAuth, (req: any, res) => {
    const operator = req.user;
    const { page, limit } = req.query;
    const activeInspections = db.inspections.filter(i => !i.isDeleted);
    
    if (operator.role === 'Super Admin') {
      const paginated = paginateArray(activeInspections, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(activeInspections);
      }
    } else if (operator.role === 'Organization Admin') {
      const myBuildings = db.buildings.filter(b => b.organizationId === operator.organizationId).map(b => b.id);
      const myFloors = db.floors.filter(f => myBuildings.includes(f.buildingId)).map(f => f.id);
      const myRooms = db.rooms.filter(r => myFloors.includes(r.floorId)).map(r => r.id);
      const filtered = activeInspections.filter(i => myRooms.includes(i.roomId));
      
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    } else {
      // Inspectors only see their own inspections
      const filtered = activeInspections.filter(i => i.inspectorId === operator.id);
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    }
  });

  app.post('/api/inspections', requireAuth, validateRequest({ body: createInspectionSchema }), async (req: any, res) => {
    const { roomId, inspectorId, cleaned, rating, remarks, deviceTime, photoUrl, signatureUrl, latitude, longitude } = req.body;
    const operator = req.user;

    const finalInspectorId = inspectorId || operator.id;

    // Security verification: Inspectors can only log as themselves
    if (operator.role === 'Inspector' && operator.id !== finalInspectorId) {
      return res.status(403).json({ error: 'Access denied: You cannot submit audits for other inspectors.' });
    }

    const room = db.rooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Target room not found' });
    }

    // Verify organization alignment
    const building = db.buildings.find(b => b.id === room.buildingId);
    if (building && operator.role !== 'Super Admin' && building.organizationId !== operator.organizationId) {
      return res.status(403).json({ error: 'Access denied: Room belongs to a different organization.' });
    }

    const DUPLICATE_COOLDOWN_MS = 60000;
    const lastInspection = db.inspections.find(i => i.roomId === roomId && i.inspectorId === finalInspectorId);
    if (lastInspection) {
      const timeDiff = Date.now() - new Date(lastInspection.createdAt).getTime();
      if (timeDiff < DUPLICATE_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((DUPLICATE_COOLDOWN_MS - timeDiff) / 1000);
        return res.status(429).json({ 
          error: `Duplicate submission blocked. An audit for this room was already logged ${Math.round(timeDiff/1000)} seconds ago. Please wait ${secondsRemaining} seconds or reset.` 
        });
      }
    }

    const floor = db.floors.find(f => f.id === room.floorId);
    const org = building ? db.organizations.find(o => o.id === building.organizationId) : null;
    const inspector = db.users.find(u => u.id === finalInspectorId);

    const currentHour = new Date().getHours();
    let detectedShift: 'Morning' | 'Afternoon' | 'Night' = 'Night';
    if (currentHour >= 6 && currentHour < 14) {
      detectedShift = 'Morning';
    } else if (currentHour >= 14 && currentHour < 22) {
      detectedShift = 'Afternoon';
    }

    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const receiptNumber = `CC-${todayStr}-${randomDigits}`;

    const processedPhotoUrl = await saveBase64Image(photoUrl, 'photo');
    const processedSignatureUrl = await saveBase64Image(signatureUrl, 'sig');

    const newInspection: Inspection = {
      id: `ins-${Date.now()}`,
      roomId,
      roomName: room.name,
      floorName: floor ? floor.name : 'Unknown Floor',
      buildingName: building ? building.name : 'Unknown Building',
      organizationName: org ? org.name : 'Unknown Organization',
      inspectorId: finalInspectorId,
      inspectorName: inspector ? inspector.fullName : 'Staff Inspector',
      cleaned: !!cleaned,
      rating: parseInt(rating, 10),
      remarks: remarks || '',
      deviceTime: deviceTime || new Date().toISOString(),
      photoUrl: processedPhotoUrl,
      signatureUrl: processedSignatureUrl,
      latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
      longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
      syncedToGoogleSheets: false,
      createdAt: new Date().toISOString(),
      shift: detectedShift,
      status: 'Submitted',
      receiptNumber
    };

    // If auto-sync settings are turned on, simulate appending sheets
    if (db.settings.autoSync) {
      newInspection.syncedToGoogleSheets = true;
      newInspection.syncedAt = new Date().toISOString();
    }

    dbInsert('inspections', newInspection);

    // Log this action
    logAction(
      finalInspectorId, 
      inspector ? inspector.username : 'inspector', 
      'Perform Inspection', 
      `Logged inspection for ${room.name}: Rating=${rating}*, Cleaned=${cleaned}, GPS=(${newInspection.latitude || 'N/A'}, ${newInspection.longitude || 'N/A'})`
    );

    res.json(newInspection);
  });

  app.delete('/api/inspections/:id', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await inspectionService.deleteInspection(id, operator);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Delete Inspection Service Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to delete inspection.' });
    }
  });

  // --- ASSIGNMENTS CONTROLLER ---
  app.get('/api/assignments', requireAuth, (req: any, res) => {
    const operator = req.user;
    const { page, limit } = req.query;
    const assignmentsList = (db.assignments || []).filter(a => !a.isDeleted);

    if (operator.role === 'Super Admin') {
      const paginated = paginateArray(assignmentsList, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(assignmentsList);
      }
    } else if (operator.role === 'Organization Admin') {
      // Filter to only assignments for inspectors in our organization
      const myUserIds = db.users.filter(u => u.organizationId === operator.organizationId).map(u => u.id);
      const filtered = assignmentsList.filter(a => myUserIds.includes(a.inspectorId));
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    } else {
      // Inspector: only their own assignments
      const filtered = assignmentsList.filter(a => a.inspectorId === operator.id);
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    }
  });

  app.post('/api/assignments', requireAuth, verifyAdminAccess, validateRequest({ body: createAssignmentSchema }), (req: any, res) => {
    const { inspectorId, roomIds, shift, date } = req.body;
    const operator = req.user;

    const inspector = db.users.find(u => u.id === inspectorId);
    if (!inspector) {
      return res.status(404).json({ error: 'Inspector not found.' });
    }

    // Tenant Isolation Check
    if (operator.role === 'Organization Admin') {
      if (inspector.organizationId !== operator.organizationId) {
        return res.status(403).json({ error: 'Access denied: Inspector belongs to a different organization.' });
      }
      
      // Verify all specified rooms belong to our organization
      for (const rId of roomIds) {
        const room = db.rooms.find(r => r.id === rId);
        if (room) {
          const building = db.buildings.find(b => b.id === room.buildingId);
          if (building && building.organizationId !== operator.organizationId) {
            return res.status(403).json({ error: `Access denied: Room ID ${rId} belongs to a different organization.` });
          }
        }
      }
    }

    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      inspectorId,
      inspectorName: inspector.fullName,
      roomIds,
      shift,
      date,
      createdAt: new Date().toISOString()
    };

    dbInsert('assignments', newAssignment);

    logAction(operator.id, operator.username, 'Create Assignment', `Assigned ${roomIds.length} rooms to ${inspector.fullName} for shift ${shift} on ${date}`);
    res.json(newAssignment);
  });

  app.delete('/api/assignments/:id', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const { id } = req.params;
    const operator = req.user;

    try {
      await assignmentService.deleteAssignment(id, operator);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Delete Assignment Service Error]:', error.message || error);
      res.status(error.message.includes('Access denied') ? 403 : error.message.includes('not found') ? 404 : 500)
        .json({ error: error.message || 'Failed to delete assignment.' });
    }
  });

  // --- SUPERVISOR VERIFICATION CONTROLLER ---
  app.post('/api/inspections/:id/verify', requireAuth, verifyAdminAccess, (req: any, res) => {
    const { id } = req.params;
    const { status, supervisorRemarks } = req.body;
    const operator = req.user;

    if (!status || !['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either Verified or Rejected.' });
    }

    const index = db.inspections.findIndex(i => i.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Inspection report not found.' });
    }

    const targetInspection = db.inspections[index];
    const room = db.rooms.find(r => r.id === targetInspection.roomId);

    // Isolation Check
    if (room && operator.role === 'Organization Admin') {
      const building = db.buildings.find(b => b.id === room.buildingId);
      if (building && building.organizationId !== operator.organizationId) {
        return res.status(403).json({ error: 'Access denied: Inspection belongs to a different organization.' });
      }
    }

    const updatedInspection = {
      ...db.inspections[index],
      status: status,
      supervisorRemarks: supervisorRemarks || '',
      verifiedAt: new Date().toISOString()
    };

    dbUpdate('inspections', id, updatedInspection);

    logAction(
      operator.id,
      operator.username,
      'Verify Inspection',
      `Set status to ${status} for report ${db.inspections[index].receiptNumber}. Remarks: ${supervisorRemarks || 'None'}`
    );

    res.json(db.inspections[index]);
  });


  // --- CLOUD SYNC MANUAL RETRY ENDPOINT ---
  app.post('/api/sync/retry', requireAuth, verifyAdminAccess, async (req: any, res) => {
    const operator = req.user;
    
    try {
      if (firestoreEnabled) {
        console.log("[Firestore Sync] Manual sync retry triggered by administrator. Resetting status/attempts of all queued items...");
        
        // Reset all queue items so they are eligible to be retried instantly
        if (db.syncQueue && db.syncQueue.length > 0) {
          db.syncQueue = db.syncQueue.map(item => ({
            ...item,
            status: 'PENDING',
            attempts: 0,
            nextRunAt: undefined
          }));
          updateMemoryCache(db);
        }

        await flushSyncQueue();
        
        logAction(
          operator.id,
          operator.username,
          'Manual Sync Retry',
          `Triggered cloud synchronization retry. Resulting status: ${syncState}. Pending queue size: ${db.syncQueue ? db.syncQueue.length : 0}`
        );

        res.json({
          success: true,
          status: syncState,
          queuedCount: db.syncQueue ? db.syncQueue.length : 0,
          lastSyncTime,
          lastError: lastSyncError
        });
      } else {
        res.status(400).json({ error: 'Firestore integration is not configured or disabled.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retry cloud synchronization.' });
    }
  });

  // --- SYSTEM STATUS & DIAGNOSTICS ENDPOINT ---
  app.get('/api/system/status', requireAuth, verifyAdminAccess, (req: any, res) => {
    res.json({
      mongodb: {
        enabled: mongoEnabled,
        connected: mongoEnabled && !!mongoDb,
        databaseName: mongoEnabled && mongoDb ? mongoDb.databaseName : null
      },
      firestore: {
        enabled: firestoreEnabled,
        syncState,
        lastSyncTime,
        lastSyncError
      }
    });
  });


  // Periodic background queue synchronization worker
  setInterval(async () => {
    if (firestoreEnabled && db.syncQueue && db.syncQueue.length > 0) {
      await flushSyncQueue();
    }
  }, 15000); // Check and attempt to flush every 15 seconds


  // --- SETTINGS APIS ---
  app.get('/api/settings', requireAuth, verifyAdminAccess, (req, res) => {
    res.json(db.settings);
  });

  app.post('/api/settings', requireAuth, verifySuperAdminAccess, validateRequest({ body: updateSettingsSchema }), (req: any, res) => {
    const { 
      smtpHost, 
      smtpPort, 
      smtpUser, 
      companyName, 
      companyLogoUrl, 
      autoSync
    } = req.body;
    const operator = req.user;

    const updatedSettings = {
      ...db.settings,
      smtpHost: smtpHost !== undefined ? smtpHost : db.settings.smtpHost,
      smtpPort: smtpPort !== undefined ? smtpPort : db.settings.smtpPort,
      smtpUser: smtpUser !== undefined ? smtpUser : db.settings.smtpUser,
      companyName: companyName !== undefined ? companyName : db.settings.companyName,
      companyLogoUrl: companyLogoUrl !== undefined ? companyLogoUrl : db.settings.companyLogoUrl,
      autoSync: autoSync !== undefined ? !!autoSync : db.settings.autoSync
    };

    dbUpdate('settings', 'global', updatedSettings);
    logAction(operator.id, operator.username, 'Update Settings', 'Global facility inspection configuration modified.');
    res.json(updatedSettings);
  });


  // --- AUDIT LOGS ---
  app.get('/api/audit-logs', requireAuth, verifyAdminAccess, (req: any, res) => {
    const operator = req.user;
    const { page, limit } = req.query;
    
    if (operator.role === 'Super Admin') {
      const paginated = paginateArray(db.auditLogs, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(db.auditLogs);
      }
    } else {
      // Filter audit logs to actions taken by users within our organization
      const myUserIds = db.users.filter(u => u.organizationId === operator.organizationId).map(u => u.id);
      const filtered = db.auditLogs.filter(log => myUserIds.includes(log.userId));
      const paginated = paginateArray(filtered, page, limit);
      if (paginated) {
        res.json(paginated);
      } else {
        res.json(filtered);
      }
    }
  });


  // --- VITE DEV OR PRODUCTION ASSETS SERVING ---
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Static Serving] Vite development server middleware loaded.');
  } else {
    // Try process.cwd()/dist first, fallback to currentDirname or __dirname/dist
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath) && currentDirname) {
      distPath = path.extname(currentDirname) ? path.dirname(currentDirname) : currentDirname;
    }

    if (fs.existsSync(distPath)) {
      console.log(`[Static Serving] Verified production dist directory at: ${distPath}`);
    } else {
      console.error(`[Static Serving ERROR] Dist directory missing at resolved path: ${distPath}`);
    }

    // Serve static files from compiled dist directory
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true
    }));

    // SPA fallback: serve index.html for non-API client routes
    app.get('*', (req: any, res: any, next: any) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('CleanCheck client bundle (index.html) not found.');
      }
    });
    console.log('[Static Serving] Production static assets and SPA fallback mounted.');
  }

  // --- CENTRAL ERROR HANDLER MIDDLEWARE ---
  // MUST be registered AFTER static asset serving and SPA fallback
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(`[Central Error Handler] Request ID: ${req.id || 'N/A'} - Path: ${req.path} - Error:`, err);
    
    const status = err.status || err.statusCode || 500;
    const response: any = {
      success: false,
      message: isProd ? (status >= 500 ? 'Internal Server Error' : err.message) : (err.message || 'An unexpected error occurred.'),
      code: err.code || 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.id || undefined
    };

    if (!isProd && err.stack) {
      response.stack = err.stack;
    }

    res.status(status).json(response);
  });

  function startAutomatedBackupScheduler() {
    console.log('[Scheduler] Starting automated daily backup scheduler...');
    
    const runBackupJob = async () => {
      try {
        console.log('[Scheduler] Executing scheduled database backup...');
        if (!fs.existsSync(BACKUPS_DIR)) {
          fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }

        // 1. Create JSON backup
        const collections = ['users', 'organizations', 'buildings', 'floors', 'rooms', 'qrcodes', 'assignments', 'inspections', 'audit_logs', 'logs', 'settings'];
        const snapshot: Record<string, any[]> = {};
        
        for (const col of collections) {
          const colName = getMongoCollectionName(col);
          const docs = await dbFind(colName);
          snapshot[col] = docs;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-auto-${timestamp}.json`;
        await saveBackupSnapshot(filename, JSON.stringify(snapshot, null, 2));
        console.log(`[Scheduler] Auto-backup created successfully: ${filename}`);

        // 2. Clean up backups older than 30 days
        const files = fs.readdirSync(BACKUPS_DIR);
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

        for (const file of files) {
          const fPath = path.join(BACKUPS_DIR, file);
          const stats = fs.statSync(fPath);
          if (now - stats.mtimeMs > THIRTY_DAYS_MS) {
            fs.unlinkSync(fPath);
            console.log(`[Scheduler] Pruned old backup file: ${file} (older than 30 days)`);
          }
        }
      } catch (err: any) {
        console.error('[Scheduler] Scheduled backup failed:', err.message || err);
      }
    };

    // Run automatically in 10 seconds, then every 24 hours
    setTimeout(() => {
      runBackupJob();
    }, 10000);

    setInterval(runBackupJob, 24 * 60 * 60 * 1000);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CleanCheck facility core running at http://localhost:${port}`);
    startAutomatedBackupScheduler();
  });
}

const isMain = process.argv[1] && (
  process.argv[1] === currentFilename ||
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('dist/server.cjs')
);

if (isMain) {
  startServer().catch((err) => {
    console.error('Fatal facility server crash:', err);
    process.exit(1);
  });
}
