import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Zod error formatter middleware
export function validateRequest(schemas: { body?: z.ZodSchema; query?: z.ZodSchema; params?: z.ZodSchema }) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString(),
          requestId: (req as any).id || undefined
        });
      }
      next(error);
    }
  };
}

// 1. Auth Schemas
export const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long')
});

// 2. User Schemas
export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['Super Admin', 'Organization Admin', 'Inspector']),
  organizationId: z.string().optional().nullable(),
  avatarUrl: z.string().optional(),
  password: z.string().optional()
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  fullName: z.string().min(1, 'Full name is required').optional(),
  role: z.enum(['Super Admin', 'Organization Admin', 'Inspector']).optional(),
  organizationId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  avatarUrl: z.string().optional(),
  password: z.string().optional()
});

// 3. Organization Schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  code: z.string().min(2, 'Organization code must be at least 2 characters').toUpperCase(),
  address: z.string().optional(),
  contactEmail: z.string().email('Invalid contact email').optional().or(z.literal(''))
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').optional(),
  code: z.string().min(2, 'Organization code must be at least 2 characters').toUpperCase().optional(),
  address: z.string().optional(),
  contactEmail: z.string().email('Invalid contact email').optional().or(z.literal(''))
});

// 4. Building Schemas
export const createBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  organizationId: z.string().min(1, 'Organization reference is required'),
  address: z.string().optional()
});

export const updateBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').optional(),
  organizationId: z.string().optional(),
  address: z.string().optional()
});

// 5. Floor Schemas
export const createFloorSchema = z.object({
  name: z.string().min(1, 'Floor name is required'),
  buildingId: z.string().min(1, 'Building reference is required')
});

export const updateFloorSchema = z.object({
  name: z.string().min(1, 'Floor name is required').optional(),
  buildingId: z.string().optional()
});

// 6. Room Schemas
export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  floorId: z.string().min(1, 'Floor reference is required'),
  type: z.string().min(1, 'Room type is required')
});

export const updateRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').optional(),
  floorId: z.string().optional(),
  type: z.string().optional()
});

// 7. Assignment Schemas
export const createAssignmentSchema = z.object({
  inspectorId: z.string().min(1, 'Inspector selection is required'),
  shift: z.string().min(1, 'Shift selection is required'),
  date: z.string().min(1, 'Inspection date is required'),
  roomIds: z.array(z.string()).min(1, 'At least one target room must be assigned')
});

// 8. Inspection Schemas
export const createInspectionSchema = z.object({
  roomId: z.string().min(1, 'Room reference is required'),
  inspectorId: z.string().optional(),
  cleaned: z.boolean(),
  rating: z.number().min(1).max(5),
  remarks: z.string().optional().default(''),
  deviceTime: z.string().optional(),
  photoUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

// 9. QR Schemas
export const regenerateQrSchema = z.object({
  roomId: z.string().min(1, 'Room reference is required')
});

export const toggleQrSchema = z.object({
  roomId: z.string().min(1, 'Room reference is required'),
  status: z.enum(['Active', 'Suspended'])
});

// 10. Settings Schema
export const updateSettingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  companyName: z.string().optional(),
  companyLogoUrl: z.string().optional(),
  autoSync: z.boolean().optional()
});
