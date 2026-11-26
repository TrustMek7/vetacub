import * as SQLite from 'expo-sqlite';
import { ddl, VERSION_ESQUEMA } from './schema';

export type DB = SQLite.SQLiteDatabase;

let instancia: Promise<DB> | null = null;

/** Abre (una sola vez) la BD local y aplica migraciones. Todo funciona sin conexión. */
export function abrirBD(): Promise<DB> {
  if (!instancia) {
    instancia = (async () => {
      const db = await SQLite.openDatabaseAsync('vetacub.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const actual = fila?.user_version ?? 0;
      if (actual < VERSION_ESQUEMA) {
        await db.withTransactionAsync(async () => {
          for (const s of ddl()) await db.execAsync(s);
          // Migraciones futuras: if (actual < 2) { ALTER TABLE ... }
          await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
        });
      }
      return db;
    })();
  }
  return instancia;
}
