export type UserRole = 'Super Admin' | 'Organization Admin' | 'Inspector';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  organizationId?: string;
  active: boolean;
  avatarUrl?: string;
  passwordHash?: string;
  salt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  lastLoginDevice?: string;
  passwordChangedAt?: string;
  passwordVersion?: number;
  migrationVersion?: number;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
  address?: string;
  contactEmail?: string;
}

export interface Building {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  createdAt: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string; // e.g., "Ground Floor", "1st Floor", "Basement"
  level: number; // e.g., 0, 1, -1
  createdAt: string;
}

export interface Room {
  id: string;
  floorId: string;
  buildingId: string;
  name: string; // e.g., "Restroom A", "Conference Room 102", "Lobby"
  type: string; // "Restroom" | "Office" | "Kitchen" | "Conference" | "Other"
  qrToken: string; // Secure token for scanning
  createdAt: string;
}

export interface QrCodeDetails {
  roomId: string;
  token: string;
  generatedAt: string;
  scansCount: number;
  lastScannedAt?: string;
  status: 'Active' | 'Disabled';
}

export interface Inspection {
  id: string;
  roomId: string;
  roomName: string;
  floorName: string;
  buildingName: string;
  organizationName: string;
  inspectorId: string;
  inspectorName: string;
  cleaned: boolean;
  rating: number; // 1 to 5 stars
  remarks: string;
  deviceTime: string;
  photoUrl?: string;
  signatureUrl?: string; // Base64 signature image
  latitude?: number;
  longitude?: number;
  syncedToGoogleSheets: boolean;
  syncedAt?: string;
  createdAt: string;
  shift?: 'Morning' | 'Afternoon' | 'Night';
  status?: 'Submitted' | 'Verified' | 'Rejected';
  receiptNumber?: string;
  supervisorRemarks?: string;
  verifiedAt?: string;
}

export interface Assignment {
  id: string;
  inspectorId: string;
  inspectorName: string;
  roomIds: string[]; // List of room IDs assigned
  shift: 'Morning' | 'Afternoon' | 'Night';
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface AppSettings {
  googleSheetsId: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  companyName: string;
  companyLogoUrl: string;
  autoSync: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g., "Create Room", "Perform Inspection", "Generate QR"
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export type SyncState = 'CONNECTED' | 'DEGRADED' | 'OFFLINE' | 'RECOVERING';

export type SyncQueueItemStatus = 'PENDING' | 'PROCESSING' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  collection: string;
  docId: string;
  data: any;
  operation: 'set' | 'delete';
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: SyncQueueItemStatus;
  nextRunAt?: string; // Eligible time after backoff delay
}

export interface SyncHealthInfo {
  status: SyncState;
  lastSyncTime?: string;
  queuedCount: number;
  failedCount: number; // Items that are marked FAILED
  oldestQueuedTime?: string;
  lastError?: string;
}

export interface DashboardStats {
  todayChecksCount: number;
  pendingRoomsCount: number;
  averageRating: number;
  failedInspectionsCount: number; // inspections with rating < 3 or not cleaned
  totalOrganizations: number;
  totalBuildings: number;
  totalFloors: number;
  totalRooms: number;
  recentInspections: Inspection[];
  assignedInspectionsCount?: number;
  completedAssignedCount?: number;
  pendingAssignedCount?: number;
  activeManagersCount?: number;
  activeInspectorsCount?: number;
  weeklyAuditsCount?: number;
  monthlyAuditsCount?: number;
  qrScanSuccessCount?: number;
  compliancePercentage?: number;
  syncHealth?: SyncHealthInfo;
}
