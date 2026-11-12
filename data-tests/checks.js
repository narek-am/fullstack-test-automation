const fs = require('node:fs');
const path = require('node:path');

const CHECKS_DIR = path.join(__dirname, 'sql', 'checks');

/** Loads every *.sql check. The first comment line is used as the description. */
function loadChecks() {
  return fs
    .readdirSync(CHECKS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(CHECKS_DIR, file), 'utf8');
      const description = (sql.match(/^--\s*(.+)$/m) || [])[1] || file;
      return { name: file.replace(/\.sql$/, ''), description, sql };
    });
}

/** Runs one check; returns the rows that break the rule (empty array = pass). */
function runCheck(db, check) {
  return db.prepare(check.sql).all();
}

module.exports = { loadChecks, runCheck };
