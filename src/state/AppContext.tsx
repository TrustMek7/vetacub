// Estado global: BD, operación activa, datos cargados y estimación calculada en el dispositivo.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { abrirBD, type DB } from '../db/database';
import * as R from '../db/repos';
import { almacenSqlite } from '../db/syncStore';
import { sincronizar, type ResumenSync } from '../sync/syncEngine';
import { transporteHttp } from '../sync/httpTransport';
import { estimar, type Estimacion } from '../engine';
import type { Bocamina, Galeria, Liquidacion, Muestra, Operacion, Parametros } from '../domain/types';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';

interface Estado {
  db: DB | null;
  listo: boolean;
  operaciones: Operacion[];
  operacionId: string | null;
  bocamina: Bocamina | null;
  galerias: Galeria[];
  muestras: Muestra[];
  liquidaciones: Liquidacion[];
  params: Parametros;
  estimacion: Estimacion | null;
  errorCalculo: string | null;
  sincronizando: boolean;
  ultimoSync: ResumenSync | null;
}

interface Ctx extends Estado {
  recargar: () => Promise<void>;
  elegirOperacion: (id: string) => Promise<void>;
  sincronizarAhora: () => Promise<ResumenSync | null>;
  syncUrl: string;
  setSyncUrl: (u: string) => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [s, set] = useState<Estado>({
    db: null, listo: false, operaciones: [], operacionId: null, bocamina: null, galerias: [], muestras: [], liquidaciones: [],
    params: PARAMETROS_POR_DEFECTO, estimacion: null, errorCalculo: null, sincronizando: false, ultimoSync: null,
  });
  const [syncUrl, setSyncUrlState] = useState<string>((Constants.expoConfig?.extra?.syncUrl as string) ?? '');
  const sincronizandoRef = useRef(false);

  const cargar = useCallback(async (db: DB, opId: string | null) => {
    const operaciones = await R.operaciones(db);
    const id = opId && operaciones.some((o) => o.id === opId) ? opId : operaciones[0]?.id ?? null;
    if (!id) { set((p) => ({ ...p, db, listo: true, operaciones, operacionId: null, bocamina: null, galerias: [], muestras: [], liquidaciones: [], estimacion: null })); return; }
    const [bocamina, galerias, muestras, liquidaciones, prm] = await Promise.all([
      R.bocaminaDe(db, id), R.galeriasDe(db, id), R.muestrasDe(db, id), R.liquidacionesDe(db, id), R.parametrosDe(db, id),
    ]);
    set((p) => ({ ...p, db, listo: true, operaciones, operacionId: id, bocamina, galerias, muestras, liquidaciones, params: prm.valores }));
  }, []);

  useEffect(() => {
    (async () => {
      const db = await abrirBD();
      const url = await R.getMeta(db, 'syncUrl');
      if (url) setSyncUrlState(url);
      await cargar(db, await R.getMeta(db, 'operacionActiva'));
    })();
  }, [cargar]);

  // Cálculo local: se recalcula cuando cambian datos o parámetros.
  const { estimacion, errorCalculo } = useMemo(() => {
    if (!s.bocamina) return { estimacion: null, errorCalculo: null };
    try {
      return { estimacion: estimar({ bocamina: s.bocamina, galerias: s.galerias, muestras: s.muestras, liquidaciones: s.liquidaciones, params: s.params }), errorCalculo: null };
    } catch (e) {
      return { estimacion: null, errorCalculo: e instanceof Error ? e.message : String(e) };
    }
  }, [s.bocamina, s.galerias, s.muestras, s.liquidaciones, s.params]);

  const recargar = useCallback(async () => { if (s.db) await cargar(s.db, s.operacionId); }, [s.db, s.operacionId, cargar]);

  const elegirOperacion = useCallback(async (id: string) => {
    if (!s.db) return;
    await R.setMeta(s.db, 'operacionActiva', id);
    await cargar(s.db, id);
  }, [s.db, cargar]);

  const sincronizarAhora = useCallback(async () => {
    if (!s.db || sincronizandoRef.current || !syncUrl || syncUrl.includes('TU-BACKEND')) return null;
    sincronizandoRef.current = true;
    set((p) => ({ ...p, sincronizando: true }));
    try {
      let deviceId = await R.getMeta(s.db, 'deviceId');
      if (!deviceId) { deviceId = R.nuevoId(); await R.setMeta(s.db, 'deviceId', deviceId); }
      const token = await R.getMeta(s.db, 'token');
      const r = await sincronizar(almacenSqlite(s.db), transporteHttp(syncUrl, token), { deviceId, uuid: R.nuevoId });
      await s.db.runAsync('INSERT INTO sync_log (fecha, resumen) VALUES (?, ?)', [new Date().toISOString(), JSON.stringify(r)]);
      set((p) => ({ ...p, ultimoSync: r }));
      await cargar(s.db, s.operacionId);
      return r;
    } finally {
      sincronizandoRef.current = false;
      set((p) => ({ ...p, sincronizando: false }));
    }
  }, [s.db, s.operacionId, syncUrl, cargar]);

  // Sincronizar al detectar conexión (y cada vez que vuelve la señal).
  useEffect(() => {
    let previo = false;
    const unsub = NetInfo.addEventListener((st) => {
      const online = !!st.isConnected && st.isInternetReachable !== false;
      if (online && !previo) void sincronizarAhora();
      previo = online;
    });
    return unsub;
  }, [sincronizarAhora]);

  const setSyncUrl = useCallback(async (u: string) => { setSyncUrlState(u); if (s.db) await R.setMeta(s.db, 'syncUrl', u); }, [s.db]);

  const valor: Ctx = { ...s, estimacion, errorCalculo, recargar, elegirOperacion, sincronizarAhora, syncUrl, setSyncUrl };
  return <AppCtx.Provider value={valor}>{children}</AppCtx.Provider>;
}
