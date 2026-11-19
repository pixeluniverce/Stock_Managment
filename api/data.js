const { MongoClient } = require('mongodb');

function collection() {
  if (!global._stockClient) {
    global._stockClient = new MongoClient(process.env.MONGODB_URI).connect();
  }
  return global._stockClient.then((c) =>
    c.db(process.env.MONGODB_DB || 'stockbook').collection('docs')
  );
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pin = process.env.APP_PIN;
  if (!pin || req.headers['x-pin'] !== pin) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const c = await collection();
    if (req.method === 'GET') {
      const rows = await c.find({}).toArray();
      const docs = {};
      for (const r of rows) {
        const { _id, ...rest } = r;
        docs[_id] = rest;
      }
      return res.status(200).json({ docs });
    }
    if (req.method === 'POST') {
      const docs = (req.body && req.body.docs) || {};
      const ops = Object.entries(docs).map(([id, data]) => ({
        replaceOne: { filter: { _id: id }, replacement: data, upsert: true },
      }));
      if (ops.length) await c.bulkWrite(ops);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    global._stockClient = null;
    return res.status(500).json({ error: 'server error' });
  }
};
