require('dotenv').config();

const express = require('express');
const cors = require('cors');

const db = require('./db');
const { fetchPage } = require('./fetcher');
const { summarizeAndTag } = require('./llm');

const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[fatal] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/items', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'http(s) URL이 필요합니다' });
    }

    const existing = db.getItemByUrl(url);
    if (existing) {
      return res.status(200).json({ ...existing, _duplicate: true });
    }

    const { title, content } = await fetchPage(url);
    if (!content || content.length < 50) {
      return res.status(422).json({ error: '본문 추출 실패 또는 본문이 너무 짧음', title });
    }

    const { summary, tags } = await summarizeAndTag({ title, content });
    const item = db.insertItem({ url, title, summary, tags, content });
    res.status(201).json(item);
  } catch (err) {
    console.error('[POST /items]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/items', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json(db.listItems(limit));
  } catch (err) {
    console.error('[GET /items]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/items/search', (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'q 쿼리 파라미터가 필요합니다' });
    }
    res.json(db.searchItems(q));
  } catch (err) {
    console.error('[GET /items/search]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const item = db.getItemById(id);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  } catch (err) {
    console.error('[GET /items/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const ok = db.deleteItem(id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    console.error('[DELETE /items/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`glean backend listening on http://localhost:${PORT}`);
});
