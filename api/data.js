const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
let ready = null;

function init() {
  if (!ready) {
    ready = sql`CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pin = process.env.APP_PIN;
  if (!pin || req.headers['x-pin'] !== pin) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    await init();
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, data FROM docs`;
      const docs = {};
      for (const r of rows) docs[r.id] = r.data;
      return res.status(200).json({ docs });
    }
    if (req.method === 'POST') {
      const docs = (req.body && req.body.docs) || {};
      for (const [id, data] of Object.entries(docs)) {
        await sql`INSERT INTO docs (id, data) VALUES (${id}, ${JSON.stringify(data)}::jsonb)
          ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
