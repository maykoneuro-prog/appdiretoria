import React, { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ShieldCheck,
  LogOut,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  Plus,
  Users,
  Lock,
  Tv,
  RefreshCw,
  AlertCircle,
  Mail,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';

export const PRIMARY_ADMIN_EMAIL = 'maykon.euro@gmail.com';
const BOOTSTRAPPED_ADMIN_EMAILS = [
  'maykon.euro@gmail.com',
  'paroquiabomsamaritano.iecb@gmail.com',
];

export interface AccessControlRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'viewer' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function sanitizeUid(rawUid: string): string {
  return rawUid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'user_default';
}

const LOCAL_AUTH_SESSION_KEY = 'sesi_pe_auth_session_record_v1';

export function useAccessControlAuth(skipAuthForTvMode: boolean) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(skipAuthForTvMode);
  const [accessRecord, setAccessRecord] = useState<AccessControlRecord | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [allRecords, setAllRecords] = useState<AccessControlRecord[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  const persistLocalSession = (rec: AccessControlRecord | null) => {
    try {
      if (rec) {
        localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(rec));
      } else {
        localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  };

  const syncUserAccessState = useCallback(async (user: User) => {
    const cleanUid = sanitizeUid(user.uid);
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanName = (user.displayName || cleanEmail.split('@')[0] || 'Usuário').slice(0, 120);
    const cleanPhoto = (user.photoURL || '').slice(0, 500);
    const isMaster = isMasterAdminEmail(cleanEmail);

    // 1. Sincroniza com o endpoint do servidor (suporta pré-aprovação por e-mail)
    let serverRecord: AccessControlRecord | null = null;
    try {
      const res = await fetch('/api/access-control/check-or-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: cleanUid,
          email: cleanEmail,
          displayName: cleanName,
          photoURL: cleanPhoto,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.userRecord) {
        serverRecord = data.userRecord;
        if (Array.isArray(data.allRecords)) {
          setAllRecords(data.allRecords);
        }
      }
    } catch {
      // Continua via Firestore
    }

    // 2. Sincroniza com o Firestore (/accessRequests/{uid}) se o e-mail for verificado no token
    if (user.emailVerified) {
      const docPath = `accessRequests/${cleanUid}`;
      const docRef = doc(db, 'accessRequests', cleanUid);
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            uid: cleanUid,
            email: cleanEmail.slice(0, 160),
            displayName: cleanName,
            photoURL: cleanPhoto,
            status: isMaster ? 'approved' : 'pending',
            role: isMaster ? 'admin' : 'viewer',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data();
          const fsStatus = isMaster
            ? 'approved'
            : (data.status as 'pending' | 'approved' | 'rejected') || 'pending';
          const fsRole = isMaster ? 'admin' : (data.role as 'viewer' | 'admin') || 'viewer';
          if (!serverRecord) {
            serverRecord = {
              uid: cleanUid,
              email: cleanEmail,
              displayName: cleanName,
              photoURL: cleanPhoto,
              status: fsStatus,
              role: fsRole,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          } else if (fsStatus !== serverRecord.status && fsStatus === 'approved') {
            serverRecord = { ...serverRecord, status: 'approved', role: fsRole };
          }
        }
      } catch (err) {
        // Caso ocorra erro de permissão no Firestore, registra pelo handler oficial se não houver fallback
        if (!serverRecord) {
          handleFirestoreError(err, OperationType.GET, docPath);
        }
      }
    }

    const finalRec: AccessControlRecord = serverRecord || {
      uid: cleanUid,
      email: cleanEmail,
      displayName: cleanName,
      photoURL: cleanPhoto,
      status: isMaster ? 'approved' : 'pending',
      role: isMaster ? 'admin' : 'viewer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAccessRecord(finalRec);
    persistLocalSession(finalRec);
  }, []);

  useEffect(() => {
    if (skipAuthForTvMode) {
      setAuthReady(true);
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncUserAccessState(user);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [skipAuthForTvMode, syncUserAccessState]);

  // Escuta mudanças em tempo real no documento do próprio usuário no Firestore
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const cleanUid = sanitizeUid(firebaseUser.uid);
    const docRef = doc(db, 'accessRequests', cleanUid);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const isMaster = isMasterAdminEmail(firebaseUser.email);
          setAccessRecord((prev) => {
            const nextRec: AccessControlRecord = {
              uid: cleanUid,
              email: String(d.email || firebaseUser.email || ''),
              displayName: String(d.displayName || firebaseUser.displayName || 'Usuário'),
              photoURL: String(d.photoURL || firebaseUser.photoURL || ''),
              status: isMaster ? 'approved' : d.status || prev?.status || 'pending',
              role: isMaster ? 'admin' : d.role || prev?.role || 'viewer',
              createdAt: prev?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            persistLocalSession(nextRec);
            return nextRec;
          });
        }
      },
      () => {
        // Ignora silenciosamente se apenas polling estiver ativo
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  // Se o usuário estiver aguardando aprovação ('pending'), verifica a cada 5s se o admin aprovou
  useEffect(() => {
    if (!accessRecord || accessRecord.status !== 'pending') return;
    const timer = setInterval(() => {
      if (firebaseUser) {
        syncUserAccessState(firebaseUser);
      } else if (accessRecord.email) {
        fetch('/api/access-control/check-or-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: accessRecord.uid,
            email: accessRecord.email,
            displayName: accessRecord.displayName,
            photoURL: accessRecord.photoURL,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok && data.userRecord) {
              setAccessRecord(data.userRecord);
              persistLocalSession(data.userRecord);
            }
          })
          .catch(() => {});
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [firebaseUser, accessRecord, syncUserAccessState]);

  const refreshAdminList = useCallback(async () => {
    try {
      const res = await fetch('/api/access-control/list');
      const data = await res.json();
      if (data?.ok && Array.isArray(data.records)) {
        setAllRecords(data.records);
      }
    } catch {
      // ignore
    }
  }, []);

  // Se for Administrador, mantém a lista de solicitações atualizada
  const isAdmin = Boolean(
    accessRecord &&
      (accessRecord.role === 'admin' || isMasterAdminEmail(accessRecord.email))
  );

  useEffect(() => {
    if (!isAdmin) return;
    refreshAdminList();
    const timer = setInterval(refreshAdminList, 8000);

    let unsubFirestore: (() => void) | null = null;
    if (firebaseUser?.emailVerified && isMasterAdminEmail(firebaseUser.email)) {
      unsubFirestore = onSnapshot(
        collection(db, 'accessRequests'),
        (snap) => {
          const fsItems: AccessControlRecord[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            fsItems.push({
              uid: String(d.uid || docSnap.id),
              email: String(d.email || '').toLowerCase(),
              displayName: String(d.displayName || 'Usuário'),
              photoURL: String(d.photoURL || ''),
              status: (d.status as 'pending' | 'approved' | 'rejected') || 'pending',
              role: (d.role as 'viewer' | 'admin') || 'viewer',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
          if (fsItems.length > 0) {
            setAllRecords((prev) => {
              const map = new Map<string, AccessControlRecord>();
              for (const item of prev) map.set(item.email.toLowerCase(), item);
              for (const item of fsItems) {
                const existing = map.get(item.email.toLowerCase());
                map.set(item.email.toLowerCase(), existing ? { ...existing, ...item } : item);
              }
              return Array.from(map.values());
            });
          }
        },
        () => {}
      );
    }

    return () => {
      clearInterval(timer);
      if (unsubFirestore) unsubFirestore();
    };
  }, [isAdmin, firebaseUser, refreshAdminList]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await syncUserAccessState(cred.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('auth/unauthorized-domain')) {
        setAuthError(
          `Este domínio (${window.location.hostname}) ainda não foi adicionado em Authorized Domains no Firebase Console, ou utilize a opção abaixo "Entrar com E-mail Cadastrado / Admin".`
        );
      } else if (!msg.includes('auth/popup-closed-by-user')) {
        setAuthError(
          'Não foi possível concluir o login com o Google. Verifique se o pop-up não foi bloqueado ou utilize o acesso por e-mail abaixo.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailDirectLogin = async (emailInput: string, nameInput?: string) => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Informe um endereço de e-mail válido.');
      return;
    }
    setAuthError(null);
    setSigningIn(true);
    try {
      const isMaster = isMasterAdminEmail(cleanEmail);
      const cleanName = (nameInput?.trim() || cleanEmail.split('@')[0] || 'Usuário').slice(0, 120);
      const cleanUid = sanitizeUid(`email_${cleanEmail}`);

      let serverRecord: AccessControlRecord | null = null;
      try {
        const res = await fetch('/api/access-control/check-or-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: cleanUid,
            email: cleanEmail,
            displayName: cleanName,
            photoURL: '',
          }),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data?.ok && data.userRecord) {
            serverRecord = data.userRecord;
            if (Array.isArray(data.allRecords)) {
              setAllRecords(data.allRecords);
            }
          }
        }
      } catch {
        // fallback para validação local/master
      }

      const finalRec: AccessControlRecord = serverRecord || {
        uid: cleanUid,
        email: cleanEmail,
        displayName: cleanName,
        photoURL: '',
        status: isMaster ? 'approved' : 'pending',
        role: isMaster ? 'admin' : 'viewer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAccessRecord(finalRec);
      persistLocalSession(finalRec);
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setAccessRecord(null);
    persistLocalSession(null);
  };

  const handleAdminDecision = async (params: {
    targetEmail: string;
    targetUid?: string;
    status?: 'pending' | 'approved' | 'rejected';
    role?: 'viewer' | 'admin';
    displayName?: string;
    deleteRecord?: boolean;
  }) => {
    // 1. Atualiza no servidor
    try {
      const res = await fetch('/api/access-control/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.records)) {
        setAllRecords(data.records);
      }
    } catch {
      // ignore
    }

    // 2. Atualiza também no Firestore se houver targetUid válido
    if (params.targetUid && !params.targetUid.startsWith('pre_') && firebaseUser?.emailVerified) {
      const cleanUid = sanitizeUid(params.targetUid);
      const docRef = doc(db, 'accessRequests', cleanUid);
      try {
        if (params.deleteRecord) {
          await deleteDoc(docRef);
        } else {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const cur = snap.data();
            await updateDoc(docRef, {
              status: params.status || cur.status || 'approved',
              role: params.role || cur.role || 'viewer',
              displayName: String(cur.displayName || params.displayName || 'Usuário').slice(0, 120),
              photoURL: String(cur.photoURL || '').slice(0, 500),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch {
        // Servidor já persistiu a decisão
      }
    }
  };

  return {
    firebaseUser,
    authReady,
    accessRecord,
    allRecords,
    isAdmin,
    authError,
    signingIn,
    handleGoogleLogin,
    handleEmailDirectLogin,
    handleLogout,
    handleAdminDecision,
    refreshAdminList,
    syncUserAccessState,
  };
}

export const AuthLoginAndPendingScreen: React.FC<{
  firebaseUser: User | null;
  accessRecord: AccessControlRecord | null;
  signingIn: boolean;
  authError: string | null;
  onGoogleLogin: () => void;
  onEmailDirectLogin?: (email: string) => void;
  onLogout: () => void;
  onRefreshStatus: () => void;
  onEnterPublicTvMode: () => void;
}> = ({
  firebaseUser,
  accessRecord,
  signingIn,
  authError,
  onGoogleLogin,
  onEmailDirectLogin,
  onLogout,
  onRefreshStatus,
  onEnterPublicTvMode,
}) => {
  const [manualEmail, setManualEmail] = useState('');
  const hasIdentifiedUser = Boolean(firebaseUser || accessRecord);
  const displayEmail = firebaseUser?.email || accessRecord?.email || '';
  const displayName =
    firebaseUser?.displayName || accessRecord?.displayName || 'Usuário Autenticado';
  const displayPhoto = firebaseUser?.photoURL || accessRecord?.photoURL || '';

  return (
    <div className="min-h-screen bg-[#F0F7FF] bg-[radial-gradient(#bae6fd_1.25px,transparent_1.25px)] bg-[size:24px_24px] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] shadow-2xl overflow-hidden">
        {/* Cabeçalho Oficial SESI-PE */}
        <div className="bg-gradient-to-br from-[#0077B6] via-[#009FE3] to-[#0284C7] px-6 py-6 text-white text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-8 h-8 text-amber-300" />
          </div>
          <div className="text-[11px] font-extrabold tracking-wider uppercase text-sky-100">
            Rede SESI Educação de Pernambuco
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Painel Matrículas 2027 & Gestão à Vista
          </h1>
          <p className="text-xs text-sky-100">
            Acesso seguro integrado com o Google e controlado pelo Administrador
          </p>
        </div>

        {/* Corpo: Tela de Login Google OU Tela de Aguardando Aprovação */}
        <div className="p-6 space-y-5">
          {!hasIdentifiedUser ? (
            <>
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5 text-xs text-slate-700 space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#009FE3] shrink-0" />
                  Acesso Restrito com Aprovação de Administrador
                </div>
                <p className="leading-relaxed text-slate-600">
                  Faça login com sua conta Google. Caso seja seu primeiro acesso, uma solicitação
                  será enviada automaticamente para aprovação do administrador{' '}
                  <strong className="text-slate-900 font-mono">{PRIMARY_ADMIN_EMAIL}</strong>.
                </p>
              </div>

              {authError && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={signingIn}
                onClick={onGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-[#009FE3] hover:bg-sky-600 text-white font-extrabold text-sm border-2 border-b-4 border-sky-700 transition-all cursor-pointer shadow-sm disabled:opacity-60"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>{signingIn ? 'Conectando ao Google...' : 'Entrar com Conta Google'}</span>
              </button>

              {onEmailDirectLogin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualEmail.trim()) onEmailDirectLogin(manualEmail.trim());
                  }}
                  className="pt-3 border-t border-slate-100 space-y-2"
                >
                  <label className="block text-[11px] font-bold text-slate-600">
                    Ou informe seu e-mail Google (Admin: <span className="font-mono">{PRIMARY_ADMIN_EMAIL}</span>):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="Ex.: maykon.euro@gmail.com"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
                    />
                    <button
                      type="submit"
                      disabled={signingIn || !manualEmail.trim()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      Entrar
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-3 border-t border-slate-100 text-center space-y-2">
                <p className="text-[11px] text-slate-500">
                  Vai abrir apenas o Mural em uma Smart TV (sem dados sensíveis)?
                </p>
                <button
                  type="button"
                  onClick={onEnterPublicTvMode}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Tv className="w-4 h-4 text-amber-700" />
                  Abrir Modo TV Público (Sem Dados Sensíveis)
                </button>
              </div>
            </>
          ) : (
            /* Usuário autenticado, porém aguardando aprovação ou recusado */
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2">
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl border-2 border-[#009FE3] object-cover shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-sky-100 text-[#009FE3] font-extrabold text-xl flex items-center justify-center">
                    {(displayName || displayEmail || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    {displayName}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-500">
                    {displayEmail}
                  </div>
                </div>
              </div>

              {accessRecord?.status === 'rejected' ? (
                <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 text-left space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm">
                    <UserX className="w-5 h-5 text-rose-600 shrink-0" />
                    Acesso Não Autorizado
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    Sua solicitação de acesso para <strong>{displayEmail}</strong> não foi
                    aprovada pelo administrador (<strong>{PRIMARY_ADMIN_EMAIL}</strong>).
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-left space-y-2">
                  <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                    <Clock className="w-5 h-5 text-amber-600 animate-pulse shrink-0" />
                    Aguardando Aprovação do Administrador
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Seu pedido de acesso já foi registrado! Assim que o administrador{' '}
                    <strong className="font-mono underline">{PRIMARY_ADMIN_EMAIL}</strong> aprovar
                    sua conta no painel, esta tela abrirá o sistema automaticamente.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onRefreshStatus}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar Agora
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Trocar Conta
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onEnterPublicTvMode}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Tv className="w-4 h-4 text-amber-700" />
                  Abrir Modo TV Público Enquanto Aguarda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminAccessControlModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  records: AccessControlRecord[];
  onDecide: (params: {
    targetEmail: string;
    targetUid?: string;
    status?: 'pending' | 'approved' | 'rejected';
    role?: 'viewer' | 'admin';
    displayName?: string;
    deleteRecord?: boolean;
  }) => Promise<void>;
}> = ({ isOpen, onClose, currentUserEmail, records, onDecide }) => {
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState<'viewer' | 'admin'>('viewer');

  if (!isOpen) return null;

  const pendingList = records.filter((r) => r.status === 'pending');
  const approvedList = records.filter((r) => r.status === 'approved');
  const rejectedList = records.filter((r) => r.status === 'rejected');

  const handlePreApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    await onDecide({
      targetEmail: clean,
      displayName: newNameInput.trim() || clean.split('@')[0],
      status: 'approved',
      role: newRoleInput,
    });
    setNewEmailInput('');
    setNewNameInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal de Aprovação */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#009FE3] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#009FE3]" />
              Controle de Segurança e Aprovação de Acessos
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              Gerenciar Usuários & Solicitações de Login Google
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Administrador e Aprovador Principal:{' '}
              <strong className="text-slate-800 font-mono">{PRIMARY_ADMIN_EMAIL}</strong> (Logado
              como: <span className="font-mono">{currentUserEmail}</span>)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. SOLICITAÇÕES PENDENTES DE APROVAÇÃO */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              1. Solicitações Pendentes de Aprovação ({pendingList.length})
            </h4>
          </div>

          {pendingList.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500 text-center">
              Nenhuma solicitação de acesso aguardando aprovação neste momento. Quando alguém tentar
              entrar com o Google, aparecerá aqui instantaneamente.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingList.map((item) => (
                <div
                  key={item.email}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-950 font-extrabold flex items-center justify-center shrink-0 overflow-hidden">
                      {item.photoURL ? (
                        <img
                          src={item.photoURL}
                          alt={item.displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (item.displayName || item.email)[0].toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">
                        {item.displayName}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-600 truncate">
                        {item.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onDecide({
                          targetEmail: item.email,
                          targetUid: item.uid,
                          status: 'approved',
                          role: 'viewer',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprovar Acesso
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDecide({
                          targetEmail: item.email,
                          targetUid: item.uid,
                          status: 'rejected',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-extrabold cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. PRÉ-APROVAR UM E-MAIL MANUALMENTE */}
        <form
          onSubmit={handlePreApproveSubmit}
          className="rounded-2xl bg-sky-50/80 border border-sky-200 p-4 space-y-3"
        >
          <div className="text-xs font-extrabold text-sky-950 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-[#009FE3]" />
            2. Liberar / Pré-Aprovar E-mail Antes do Login
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="email"
              required
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              placeholder="E-mail (ex.: colaborador@gmail.com)"
              className="sm:col-span-5 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
            />
            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="Nome / Identificação (opcional)"
              className="sm:col-span-4 px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
            />
            <select
              value={newRoleInput}
              onChange={(e) => setNewRoleInput(e.target.value as 'viewer' | 'admin')}
              className="sm:col-span-3 px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
            >
              <option value="viewer">Acesso Padrão</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Pré-Aprovar E-mail
            </button>
          </div>
        </form>

        {/* 3. LISTA DE USUÁRIOS APROVADOS E BLOQUEADOS */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#009FE3]" />
            3. E-mails Aprovados ({approvedList.length}) e Bloqueados ({rejectedList.length})
          </h4>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {/* Administrador Principal Fixo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/60">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Administrador e Aprovador Principal
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-800">
                    {PRIMARY_ADMIN_EMAIL}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-extrabold text-emerald-800">
                Administrador Vitalício
              </span>
            </div>

            {[...approvedList, ...rejectedList]
              .filter((r) => r.email.toLowerCase() !== PRIMARY_ADMIN_EMAIL)
              .map((item) => (
                <div
                  key={item.email}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {item.displayName}{' '}
                      <span className="font-normal text-slate-500">
                        · {item.role === 'admin' ? 'Administrador' : 'Acesso ao Painel'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-600 truncate">{item.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-extrabold ${
                        item.status === 'approved' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {item.status === 'approved' ? 'Aprovado' : 'Bloqueado'}
                    </span>

                    {item.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() =>
                          onDecide({
                            targetEmail: item.email,
                            targetUid: item.uid,
                            status: 'rejected',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                      >
                        Bloquear
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onDecide({
                            targetEmail: item.email,
                            targetUid: item.uid,
                            status: 'approved',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer"
                      >
                        Liberar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onDecide({
                          targetEmail: item.email,
                          targetUid: item.uid,
                          deleteRecord: true,
                        })
                      }
                      className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                      title="Remover registro"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
