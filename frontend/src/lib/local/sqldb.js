// A tiny better-sqlite3-compatible wrapper over a sql.js (SQLite-WASM) Database.
// This lets the on-device engine reuse the same SQL the server uses:
//   db.prepare(sql).get(...) / .all(...) / .run(...) , db.exec(sql),
//   db.transaction(fn), db.pragma(str).
//
// Named parameters use the @name form (as the server does); positional use ?.

export function wrap(sqljsDb) {
  function normalize(args) {
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const obj = {};
      for (const [k, v] of Object.entries(args[0])) obj['@' + k] = v === undefined ? null : v;
      return obj;
    }
    return args.map((v) => (v === undefined ? null : v));
  }

  const api = {
    _db: sqljsDb,
    prepare(sql) {
      return {
        get(...args) {
          const stmt = sqljsDb.prepare(sql);
          try {
            stmt.bind(normalize(args));
            return stmt.step() ? stmt.getAsObject() : undefined;
          } finally {
            stmt.free();
          }
        },
        all(...args) {
          const stmt = sqljsDb.prepare(sql);
          const rows = [];
          try {
            stmt.bind(normalize(args));
            while (stmt.step()) rows.push(stmt.getAsObject());
          } finally {
            stmt.free();
          }
          return rows;
        },
        run(...args) {
          sqljsDb.run(sql, normalize(args));
          const r = sqljsDb.exec('SELECT last_insert_rowid() AS id, changes() AS ch')[0].values[0];
          return { lastInsertRowid: r[0], changes: r[1] };
        },
      };
    },
    exec(sql) {
      sqljsDb.run(sql);
      return api;
    },
    pragma(str) {
      // table_info / foreign_key_list return rows; others just execute.
      try {
        const res = sqljsDb.exec('PRAGMA ' + str);
        if (res && res[0]) return res[0].values.map((row) => Object.fromEntries(res[0].columns.map((c, i) => [c, row[i]])));
      } catch (_) { /* ignore */ }
      return [];
    },
    transaction(fn) {
      return (...args) => {
        sqljsDb.run('BEGIN');
        try {
          const out = fn(...args);
          sqljsDb.run('COMMIT');
          return out;
        } catch (e) {
          try { sqljsDb.run('ROLLBACK'); } catch (_) { /* ignore */ }
          throw e;
        }
      };
    },
    export() {
      return sqljsDb.export();
    },
  };
  return api;
}
