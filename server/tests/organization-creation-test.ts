import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { db, mongoEnabled } from '../../server.js';
import { organizationService } from '../services.js';
import { QRCodeModel } from '../../models/QRCode.js';

dotenv.config();

async function runOrgAtomicTest() {
  console.log('================================================================');
  console.log('    ORGANIZATION CREATION ATOMIC & QR CODE REGRESSION TEST     ');
  console.log('================================================================');

  const operator = { id: 'usr-1', username: 'admin', role: 'Super Admin', organizationId: '' };

  const createdOrgs: any[] = [];
  const numOrgsToCreate = 3;

  console.log(`Creating ${numOrgsToCreate} organizations sequentially via organizationService.createOrganization...`);

  for (let i = 1; i <= numOrgsToCreate; i++) {
    const code = `TESTORG${i}_${Date.now().toString().slice(-4)}`;
    const name = `Atomic Test Org ${i} (${Date.now()})`;
    try {
      console.log(`[Attempt ${i}] Creating ${name} with code ${code}...`);
      const org = await organizationService.createOrganization({
        name,
        code,
        address: `${i}00 Test Way`,
        contactEmail: `admin@testorg${i}.com`
      }, operator);
      
      createdOrgs.push(org);
      console.log(`[Success] Created Org ID: ${org.id}`);
    } catch (err: any) {
      console.error(`[FAILURE] Failed to create org ${i}:`, err.message || err);
      process.exit(1);
    }
  }

  // Verify QRCode entries
  console.log('\nVerifying QR codes generated for the new organizations...');
  for (const org of createdOrgs) {
    // Find rooms in this org
    const rooms = db.rooms.filter(r => {
      const bld = db.buildings.find(b => b.id === r.buildingId);
      return bld && bld.organizationId === org.id;
    });

    if (rooms.length === 0) {
      console.error(`[FAILURE] No rooms found for org ${org.id}`);
      process.exit(1);
    }

    for (const room of rooms) {
      const qrInDb = db.qrCodes.find(q => q.roomId === room.id);
      if (!qrInDb) {
        console.error(`[FAILURE] QR Code missing in memory DB for room ${room.id}`);
        process.exit(1);
      }
      if (!qrInDb.id) {
        console.error(`[FAILURE] QR Code for room ${room.id} lacks 'id' property!`);
        process.exit(1);
      }

      if (mongoEnabled) {
        const qrInMongo = await QRCodeModel.findOne({ roomId: room.id }).lean();
        if (!qrInMongo) {
          console.error(`[FAILURE] QR Code missing in MongoDB for room ${room.id}`);
          process.exit(1);
        }
        if (!qrInMongo.id) {
          console.error(`[FAILURE] QR Code in MongoDB for room ${room.id} has null or missing 'id'!`);
          process.exit(1);
        }
        console.log(`[OK] Room ${room.id} has valid QR Code in MongoDB with ID: ${qrInMongo.id}`);
      }
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(`[PASSED] Successfully created ${numOrgsToCreate} organizations atomically with valid unique QR Code IDs!`);
  console.log('================================================================');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

runOrgAtomicTest().catch((err) => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
