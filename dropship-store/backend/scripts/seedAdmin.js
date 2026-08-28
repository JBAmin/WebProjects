require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

// Usage: node scripts/seedAdmin.js admin@example.com yourStrongPassword
async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/seedAdmin.js <email> <password>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, hash]
  );

  console.log(`Admin user ready: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
