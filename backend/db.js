const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    summary TEXT,
    tags TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_created_at ON items(created_at DESC);

  CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title, summary, tags, content,
    content='items', content_rowid='id',
    tokenize='unicode61'
  );

  CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, summary, tags, content)
    VALUES (new.id, new.title, new.summary, new.tags, new.content);
  END;

  CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, summary, tags, content)
    VALUES ('delete', old.id, old.title, old.summary, old.tags, old.content);
  END;

  CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, summary, tags, content)
    VALUES ('delete', old.id, old.title, old.summary, old.tags, old.content);
    INSERT INTO items_fts(rowid, title, summary, tags, content)
    VALUES (new.id, new.title, new.summary, new.tags, new.content);
  END;
`);

const stmts = {
  insert: db.prepare(`
    INSERT INTO items (url, title, summary, tags, content)
    VALUES (@url, @title, @summary, @tags, @content)
  `),
  findByUrl: db.prepare(`SELECT * FROM items WHERE url = ?`),
  findById: db.prepare(`SELECT * FROM items WHERE id = ?`),
  list: db.prepare(`
    SELECT id, url, title, summary, tags, created_at
    FROM items
    ORDER BY created_at DESC
    LIMIT ?
  `),
  search: db.prepare(`
    SELECT items.id, items.url, items.title, items.summary, items.tags, items.created_at
    FROM items_fts
    JOIN items ON items.id = items_fts.rowid
    WHERE items_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `),
  remove: db.prepare(`DELETE FROM items WHERE id = ?`),
};

function rowToItem(row) {
  if (!row) return null;
  let tags = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
  return { ...row, tags };
}

function insertItem({ url, title, summary, tags, content }) {
  const result = stmts.insert.run({
    url,
    title: title || '',
    summary: summary || '',
    tags: JSON.stringify(tags || []),
    content: content || '',
  });
  return getItemById(result.lastInsertRowid);
}

function getItemByUrl(url) {
  return rowToItem(stmts.findByUrl.get(url));
}

function getItemById(id) {
  return rowToItem(stmts.findById.get(id));
}

function listItems(limit = 50) {
  return stmts.list.all(limit).map(rowToItem);
}

function searchItems(query) {
  return stmts.search.all(query).map(rowToItem);
}

function deleteItem(id) {
  return stmts.remove.run(id).changes > 0;
}

module.exports = {
  insertItem,
  getItemByUrl,
  getItemById,
  listItems,
  searchItems,
  deleteItem,
};
