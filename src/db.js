const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: require('crypto').randomUUID } : { v4: () => Math.random().toString(36).substring(2) + Date.now().toString(36) };

const usePostgres = Boolean(process.env.DATABASE_URL);

let pgPool = null;
let sqliteDb = null;

if (usePostgres) {
  console.log('[DB] Connessione a PostgreSQL via DATABASE_URL...');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  const dbPath = path.join(__dirname, '..', 'survey_local.db');
  console.log(`[DB] DATABASE_URL non impostata. Utilizzo SQLite locale in: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath);
}

async function initDb() {
  if (usePostgres) {
    const client = await pgPool.connect();
    try {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf-8');
      await client.query(sql);
      console.log('[DB] Tabella PostgreSQL survey_responses verificata/creata.');
    } finally {
      client.release();
    }
  } else {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS survey_responses (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          survey_type TEXT NOT NULL,
          revenue_range TEXT,
          rankings TEXT NOT NULL,
          ratings TEXT NOT NULL,
          open_feedback TEXT
        );
      `;
      sqliteDb.run(sql, (err) => {
        if (err) {
          console.error('[DB] Errore inizializzazione SQLite:', err);
          return reject(err);
        }
        console.log('[DB] Tabella SQLite survey_responses verificata/creata.');
        resolve();
      });
    });
  }
}

async function saveResponse({ survey_type, revenue_range, rankings, ratings, open_feedback }) {
  const id = uuidv4();
  const created_at = new Date().toISOString();

  if (usePostgres) {
    const query = `
      INSERT INTO survey_responses (id, created_at, survey_type, revenue_range, rankings, ratings, open_feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at;
    `;
    const values = [
      id,
      created_at,
      survey_type,
      revenue_range || null,
      JSON.stringify(rankings),
      JSON.stringify(ratings),
      open_feedback || null
    ];
    const res = await pgPool.query(query, values);
    return res.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO survey_responses (id, created_at, survey_type, revenue_range, rankings, ratings, open_feedback)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `;
      const values = [
        id,
        created_at,
        survey_type,
        revenue_range || null,
        JSON.stringify(rankings),
        JSON.stringify(ratings),
        open_feedback || null
      ];
      sqliteDb.run(query, values, function(err) {
        if (err) return reject(err);
        resolve({ id, created_at });
      });
    });
  }
}

async function getResponses() {
  if (usePostgres) {
    const res = await pgPool.query('SELECT * FROM survey_responses ORDER BY created_at DESC;');
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM survey_responses ORDER BY created_at DESC;', [], (err, rows) => {
        if (err) return reject(err);
        const parsed = rows.map(r => ({
          ...r,
          rankings: typeof r.rankings === 'string' ? JSON.parse(r.rankings) : r.rankings,
          ratings: typeof r.ratings === 'string' ? JSON.parse(r.ratings) : r.ratings
        }));
        resolve(parsed);
      });
    });
  }
}

module.exports = {
  initDb,
  saveResponse,
  getResponses,
  usePostgres
};
