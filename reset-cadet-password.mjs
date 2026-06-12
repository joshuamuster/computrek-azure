/**
 * One-off admin script: reset a cadet's password back to the default formula
 * and flag their account for a forced password change on next login.
 *
 * Usage:
 *   node reset-cadet-password.mjs <email>
 *
 * Example:
 *   node reset-cadet-password.mjs student682972@computrekcs.edu
 *
 * Requires serviceAccountKey.json in the project root (see README or ask Claude).
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db   = admin.firestore();
const auth = admin.auth();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node reset-cadet-password.mjs <email>');
  process.exit(1);
}

async function run() {
  // 1. Pull the Firestore record so we can derive the default password
  const docRef = db.collection('approvedUsers').doc(email);
  const snap   = await docRef.get();

  if (!snap.exists) {
    console.error(`No approvedUsers record found for: ${email}`);
    process.exit(1);
  }

  const data = snap.data();
  const displayName = data.displayName || '';
  const studentId   = String(data.studentId || '');

  if (!studentId) {
    console.error('No studentId on this record — cannot derive default password.');
    process.exit(1);
  }

  // Default password formula: lowercase first name + last 2 digits of student ID
  const firstName      = displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const defaultPassword = firstName + studentId.slice(-4);

  console.log(`Student:          ${displayName}`);
  console.log(`Email:            ${email}`);
  console.log(`Default password: ${defaultPassword}`);

  // 2. Reset the Firebase Auth password
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password: defaultPassword });
  console.log('✓ Firebase Auth password reset');

  // 3. Flag account for forced password change on next login
  await docRef.update({ requiresPasswordChange: true });
  console.log('✓ requiresPasswordChange set to true');

  console.log('\nDone. Tell the student their temporary password and have them log in.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
