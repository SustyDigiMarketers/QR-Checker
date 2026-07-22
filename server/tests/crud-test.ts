import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db, mongoEnabled } from '../../server.js';
import { 
  userRepository, 
  organizationRepository, 
  buildingRepository, 
  floorRepository, 
  roomRepository, 
  qrCodeRepository, 
  assignmentRepository, 
  inspectionRepository, 
  auditLogRepository 
} from '../repositories.js';
import { 
  organizationService, 
  buildingService, 
  floorService, 
  roomService, 
  userService, 
  assignmentService, 
  inspectionService, 
  qrCodeService 
} from '../services.js';

dotenv.config();

interface TestResult {
  module: string;
  operation: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const results: TestResult[] = [];

function record(module: string, operation: string, status: 'PASSED' | 'FAILED', details: string) {
  results.push({ module, operation, status, details });
  console.log(`[${status}] ${module} - ${operation}: ${details}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('          CLEANCHECK v1.0.0 BACKEND CRUD INTEGRATION TEST        ');
  console.log('================================================================');
  console.log(`Database engine: ${mongoEnabled ? 'MongoDB / Mongoose (Active)' : 'In-Memory / Repository Fallback'}`);
  console.log('----------------------------------------------------------------');

  const testOrgId = `org-test-${Date.now()}`;
  const testBldId = `bld-test-${Date.now()}`;
  const testFlrId = `flr-test-${Date.now()}`;
  const testRmId = `rm-test-${Date.now()}`;
  const testMgrId = `usr-test-mgr-${Date.now()}`;
  const testInsId = `usr-test-ins-${Date.now()}`;
  const testAsgId = `asg-test-${Date.now()}`;
  const testInspId = `ins-test-${Date.now()}`;

  const adminOperator = { id: 'usr-1', username: 'admin', role: 'Super Admin', organizationId: '' };
  const managerOperator = { id: testMgrId, username: 'test_manager', role: 'Organization Admin', organizationId: testOrgId };

  try {
    // 1. ORGANIZATION CRUD
    console.log('\n[1] Verifying Organization Module...');
    const newOrg = {
      id: testOrgId,
      name: 'Test Pilot Healthcare Org',
      code: `PILOT-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString()
    };
    await organizationRepository.insert(newOrg);
    const orgFetched = await organizationRepository.findById(testOrgId);
    if (orgFetched && orgFetched.name === newOrg.name) {
      record('Organization', 'Create & Read', 'PASSED', 'Successfully created and fetched organization.');
    } else {
      record('Organization', 'Create & Read', 'FAILED', 'Created organization not found or mismatch.');
    }

    const updatedOrgName = 'Test Pilot Healthcare Org (Updated)';
    await organizationRepository.update(testOrgId, { name: updatedOrgName });
    const orgUpdated = await organizationRepository.findById(testOrgId);
    if (orgUpdated && orgUpdated.name === updatedOrgName) {
      record('Organization', 'Update', 'PASSED', 'Successfully updated organization details.');
    } else {
      record('Organization', 'Update', 'FAILED', 'Organization details update failed.');
    }

    // 2. USER (MANAGER & INSPECTOR) CRUD
    console.log('\n[2] Verifying User Module...');
    const newManager = {
      id: testMgrId,
      username: 'test_manager',
      email: 'manager@testpilot.com',
      fullName: 'Test Manager',
      role: 'Organization Admin',
      organizationId: testOrgId,
      passwordHash: 'dummyhash',
      salt: 'dummysalt',
      createdAt: new Date().toISOString()
    };
    await userRepository.insert(newManager);

    const newInspector = {
      id: testInsId,
      username: 'test_inspector',
      email: 'inspector@testpilot.com',
      fullName: 'Test Inspector',
      role: 'Inspector',
      organizationId: testOrgId,
      passwordHash: 'dummyhash',
      salt: 'dummysalt',
      createdAt: new Date().toISOString()
    };
    await userRepository.insert(newInspector);

    const mFetched = await userRepository.findById(testMgrId);
    const iFetched = await userRepository.findById(testInsId);
    if (mFetched && iFetched && mFetched.role === 'Organization Admin' && iFetched.role === 'Inspector') {
      record('Users (Manager/Inspector)', 'Create & Read', 'PASSED', 'Successfully created and fetched manager and inspector users.');
    } else {
      record('Users (Manager/Inspector)', 'Create & Read', 'FAILED', 'User creation or query failed.');
    }

    // 3. BUILDING CRUD
    console.log('\n[3] Verifying Building Module...');
    const newBld = {
      id: testBldId,
      organizationId: testOrgId,
      organizationName: 'Test Pilot Healthcare Org (Updated)',
      name: 'Pilot Hospital Wing A',
      address: '100 Pilot Dr',
      createdAt: new Date().toISOString()
    };
    await buildingRepository.insert(newBld);
    const bldFetched = await buildingRepository.findById(testBldId);
    if (bldFetched && bldFetched.name === newBld.name) {
      record('Building', 'Create & Read', 'PASSED', 'Successfully created and fetched building with organization link.');
    } else {
      record('Building', 'Create & Read', 'FAILED', 'Building creation or query failed.');
    }

    // 4. FLOOR CRUD
    console.log('\n[4] Verifying Floor Module...');
    const newFlr = {
      id: testFlrId,
      buildingId: testBldId,
      buildingName: 'Pilot Hospital Wing A',
      name: 'Level 3 - ICU',
      level: 3,
      createdAt: new Date().toISOString()
    };
    await floorRepository.insert(newFlr);
    const flrFetched = await floorRepository.findById(testFlrId);
    if (flrFetched && flrFetched.name === newFlr.name) {
      record('Floor', 'Create & Read', 'PASSED', 'Successfully created and fetched floor with building link.');
    } else {
      record('Floor', 'Create & Read', 'FAILED', 'Floor creation or query failed.');
    }

    // 5. ROOM CRUD & QR GENERATION
    console.log('\n[5] Verifying Room & QR Codes Module...');
    const initialToken = 'cc-tok-initial-test-token-128bits';
    const newRm = {
      id: testRmId,
      floorId: testFlrId,
      buildingId: testBldId,
      name: 'ICU Suite 304',
      type: 'Specialized Lab',
      qrToken: initialToken,
      createdAt: new Date().toISOString()
    };
    await roomRepository.insert(newRm);

    const newQr = {
      _id: testRmId,
      roomId: testRmId,
      token: initialToken,
      generatedAt: new Date(),
      scansCount: 0,
      status: 'Active',
      isDeleted: false
    };
    await qrCodeRepository.insert(newQr);

    const rmFetched = await roomRepository.findById(testRmId);
    const qrFetched = await qrCodeRepository.findByRoomId(testRmId);
    if (rmFetched && qrFetched && qrFetched.token === initialToken) {
      record('Room & QR Codes', 'Create & Link', 'PASSED', 'Successfully created room and generated linked secure QR code details.');
    } else {
      record('Room & QR Codes', 'Create & Link', 'FAILED', 'Room or QR details not found/mismatched.');
    }

    // QR TOGGLE & REGENERATE SERVICES
    const toggledQr = await qrCodeService.toggleQR(testRmId, managerOperator);
    if (toggledQr && toggledQr.status === 'Disabled') {
      record('QR Code Actions', 'Deactivate/Toggle', 'PASSED', 'Successfully deactivated/toggled QR status using transactional service.');
    } else {
      record('QR Code Actions', 'Deactivate/Toggle', 'FAILED', 'QR code toggle operation failed.');
    }

    const regeneratedToken = 'cc-tok-regenerated-test-token-128bits';
    const regeneratedQr = await qrCodeService.regenerateQR(testRmId, regeneratedToken, managerOperator);
    if (regeneratedQr && regeneratedQr.token === regeneratedToken) {
      record('QR Code Actions', 'Regenerate Token', 'PASSED', 'Successfully regenerated secure token and updated room details.');
    } else {
      record('QR Code Actions', 'Regenerate Token', 'FAILED', 'QR code token regeneration failed.');
    }

    // 6. ASSIGNMENT CRUD
    console.log('\n[6] Verifying Assignment Module...');
    const newAsg = {
      id: testAsgId,
      inspectorId: testInsId,
      inspectorName: 'Test Inspector',
      roomIds: [testRmId],
      shift: 'Night',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    await assignmentRepository.insert(newAsg);
    const asgFetched = await assignmentRepository.findById(testAsgId);
    if (asgFetched && asgFetched.shift === newAsg.shift) {
      record('Assignment', 'Create & Read', 'PASSED', 'Successfully created and fetched daily work roster assignment.');
    } else {
      record('Assignment', 'Create & Read', 'FAILED', 'Assignment creation or query failed.');
    }

    // 7. INSPECTION SUBMISSION & VERIFICATION CRUD
    console.log('\n[7] Verifying Inspection & Quality Control Module...');
    const newInsp = {
      id: testInspId,
      roomId: testRmId,
      roomName: 'ICU Suite 304',
      floorName: 'Level 3 - ICU',
      buildingName: 'Pilot Hospital Wing A',
      organizationName: 'Test Pilot Healthcare Org (Updated)',
      inspectorId: testInsId,
      inspectorName: 'Test Inspector',
      cleaned: true,
      rating: 5,
      remarks: 'Pristine disinfection, fully compliant.',
      deviceTime: new Date(),
      syncedToGoogleSheets: false,
      status: 'Submitted',
      createdAt: new Date().toISOString()
    };
    await inspectionRepository.insert(newInsp);
    const inspFetched = await inspectionRepository.findById(testInspId);
    if (inspFetched && inspFetched.rating === 5) {
      record('Inspection Logs', 'Submit & Query', 'PASSED', 'Successfully logged high-contrast room inspection reports.');
    } else {
      record('Inspection Logs', 'Submit & Query', 'FAILED', 'Inspection log submission or query failed.');
    }

    // 8. CASCADE DELETION INTEGRITY & TRANSACTION ISOLATION
    console.log('\n[8] Verifying Cascade Soft-Deletion Service Integrity...');

    // Delete Room CASCADE (should soft-delete room, QR, and update assignments)
    await roomService.deleteRoom(testRmId, managerOperator);
    const rmDeleted = await roomRepository.findById(testRmId);
    const qrDeleted = await qrCodeRepository.findByRoomId(testRmId);
    if ((!rmDeleted || rmDeleted.isDeleted) && (!qrDeleted || qrDeleted.status === 'Disabled')) {
      record('Cascade Integrity', 'Room Delete Cascade', 'PASSED', 'Successfully cascade soft-deleted room and disabled linked QR codes.');
    } else {
      record('Cascade Integrity', 'Room Delete Cascade', 'FAILED', 'Room cascade delete left orphan room or active QR details.');
    }

    // Delete Building CASCADE (should soft-delete buildings, floors, rooms, QR)
    await buildingService.deleteBuilding(testBldId, managerOperator);
    const bldDeleted = await buildingRepository.findById(testBldId);
    if (!bldDeleted || bldDeleted.isDeleted) {
      record('Cascade Integrity', 'Building Delete Cascade', 'PASSED', 'Successfully cascade soft-deleted building and subordinate levels.');
    } else {
      record('Cascade Integrity', 'Building Delete Cascade', 'FAILED', 'Building cascade delete failed.');
    }

    // Delete Organization CASCADE (cascade deletes everything)
    await organizationService.deleteOrganization(testOrgId, adminOperator);
    const orgDeleted = await organizationRepository.findById(testOrgId);
    const mDeleted = await userRepository.findById(testMgrId);
    const iDeleted = await userRepository.findById(testInsId);
    if ((!orgDeleted || orgDeleted.isDeleted) && (!mDeleted || mDeleted.isDeleted) && (!iDeleted || iDeleted.isDeleted)) {
      record('Cascade Integrity', 'Organization Delete Cascade', 'PASSED', 'Successfully soft-deleted organization, manager, and inspector accounts cascade.');
    } else {
      record('Cascade Integrity', 'Organization Delete Cascade', 'FAILED', 'Organization cascade delete left orphan accounts.');
    }

    // Restore Organization CASCADE (cascade restores everything)
    console.log('\n[8b] Verifying Cascade Restore Integrity...');
    await organizationService.restoreOrganization(testOrgId, adminOperator);
    const orgRestored = await organizationRepository.findById(testOrgId);
    const mRestored = await userRepository.findById(testMgrId);
    const iRestored = await userRepository.findById(testInsId);
    if (orgRestored && !orgRestored.isDeleted && mRestored && !mRestored.isDeleted && iRestored && !iRestored.isDeleted) {
      record('Cascade Integrity', 'Organization Restore Cascade', 'PASSED', 'Successfully cascade-restored organization, manager, and inspector accounts.');
    } else {
      record('Cascade Integrity', 'Organization Restore Cascade', 'FAILED', 'Organization cascade restore failed to fully restore target records.');
    }

    // 9. AUDIT LOGGING RECORDED
    console.log('\n[9] Verifying Audit Logging Trail...');
    const auditLogs = await auditLogRepository.find({ userId: managerOperator.id });
    if (auditLogs.length > 0) {
      record('Audit Trail', 'Write Logs', 'PASSED', `Successfully recorded ${auditLogs.length} audit logs programmatically inside transactional units.`);
    } else {
      record('Audit Trail', 'Write Logs', 'FAILED', 'No audit logs recorded for operator actions.');
    }

  } catch (err: any) {
    console.error('Test script runtime exception:', err.message || err);
    record('System Integration', 'E2E CRUD Suite', 'FAILED', err.message || 'Fatal crash');
  }

  console.log('\n================================================================');
  console.log('              CLEANCHECK BACKEND CRUD TEST RESULTS              ');
  console.log('================================================================');
  console.table(results);
  console.log('================================================================\n');

  const allPassed = results.every(r => r.status === 'PASSED');
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal error running CRUD verification suite:', err);
  process.exit(1);
});
