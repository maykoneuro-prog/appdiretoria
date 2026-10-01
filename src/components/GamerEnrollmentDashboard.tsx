import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Target,
  Share2,
  Maximize2,
  ArrowUpRight,
  Check,
  Award,
  GraduationCap,
  BookOpen,
  Compass,
  School,
  Star,
  Pencil,
  RotateCcw,
  X,
  BarChart3,
  Minimize2,
  Calendar,
  RefreshCw,
  Users,
  FileText,
  Mail,
  MessageCircle,
  Download,
  Copy,
  Cake,
  Play,
  Pause,
  ShieldCheck,
} from 'lucide-react';
import { TotvsStudentRow } from '../types/totvs';
import { EmailReportsCenterModal } from './EmailReportsCenterModal';
import {
  TeamBirthdaysMural,
  BirthdayMember,
  TvCarouselSettings,
  BIRTHDAYS_STORAGE_KEY,
  TV_CAROUSEL_STORAGE_KEY,
} from './TeamBirthdaysMural';
import {
  getPublicTvShareUrl,
  downloadStandaloneTvHtml,
} from '../utils/tvModeShareHelper';
import {
  UnitGoal2027,
  DailyEnrollmentEntry,
  TurmaOccupancyEntry,
  computeNetworkMetrics2027,
  isRenovacaoPortalRow,
  isInscricaoOnlineRow,
} from '../data/sesiGoals2027';

export type EditableGoalField =
  | 'metaGeral'
  | 'metaUnidade2027'
  | 'gratuidadeRemanescente'
  | 'pagasRenovacoes'
  | 'pagasNovatos2027'
  | 'novasVagasGratuidade2027';

interface GamerEnrollmentDashboardProps {
  rows: TotvsStudentRow[];
  goals: UnitGoal2027[];
  onUpdateGoalObs: (unitId: string, obs: string) => void;
  onUpdateUnitGoalField: (
    unitId: string,
    field: EditableGoalField,
    newValue: number
  ) => void;
  onSaveUnitGoalFull: (updatedGoal: UnitGoal2027) => void;
  onResetUnitGoals: () => void;
  onInspectUnitInGrid: (totvsUnitName: string, extraStatusQuery?: string) => void;
  isAutoSyncing: boolean;
  nextSyncSeconds: number;
  lastSyncTime: string;
  onForceSync: () => void;
  flashingUnits: Record<string, number>;
  onDismissFlash: (unitId: string) => void;
  externalViewRequest?: {
    view: 'arena' | 'planilha' | 'ambos' | 'aniversariantes';
    ts: number;
  } | null;
  isAdmin?: boolean;
  pendingApprovalsCount?: number;
  onOpenAccessControl?: () => void;
}

const InlineGoalEditor: React.FC<{
  value: number;
  onCommit: (newVal: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, onCommit, prefix = '', suffix = '', className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (!Number.isNaN(parsed) && parsed >= 0 && Math.round(parsed) !== value) {
      onCommit(Math.round(parsed));
    }
  };

  if (editing) {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5"
      >
        {prefix && <span>{prefix}</span>}
        <input
          type="number"
          min={0}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-20 px-1.5 py-0.5 text-xs font-mono font-extrabold text-slate-900 bg-amber-50 border-2 border-[#009FE3] rounded-md focus:outline-none"
        />
        {suffix && <span>{suffix}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Clique para ajustar o valor desta meta"
      className={`inline-flex items-center gap-1 rounded px-1 -mx-0.5 underline decoration-dashed decoration-sky-400 underline-offset-4 hover:bg-amber-100/90 hover:text-sky-900 transition-colors cursor-pointer ${className}`}
    >
      <span>
        {prefix}
        {value.toLocaleString('pt-BR')}
        {suffix}
      </span>
      <Pencil className="w-2.5 h-2.5 opacity-60 shrink-0" />
    </button>
  );
};

export const GamerEnrollmentDashboard: React.FC<GamerEnrollmentDashboardProps> = ({
  rows,
  goals,
  onUpdateGoalObs,
  onUpdateUnitGoalField,
  onSaveUnitGoalFull,
  onResetUnitGoals,
  onInspectUnitInGrid,
  isAutoSyncing,
  nextSyncSeconds,
  lastSyncTime,
  onForceSync,
  flashingUnits,
  onDismissFlash,
  externalViewRequest,
  isAdmin = false,
  pendingApprovalsCount = 0,
  onOpenAccessControl,
}) => {
  // Regra oficial: Apenas alunos com situação Matriculado ou Pré Matriculado
  // contam como matriculados (tanto Novatos quanto Veteranos/Remanescentes).
  // Matrícula Reservada e Renovação via Portal NÃO contam como matriculados.
  const [rankBy, setRankBy] = useState<'pct' | 'volume'>('pct');
  const [viewSection, setViewSection] = useState<
    'arena' | 'planilha' | 'ambos' | 'aniversariantes'
  >(() => {
    try {
      const isTv =
        new URLSearchParams(window.location.search).get('tv') === '1' ||
        window.location.hostname.endsWith('.trycloudflare.com');
      return isTv ? 'arena' : 'ambos';
    } catch {
      return 'ambos';
    }
  });

  useEffect(() => {
    if (externalViewRequest?.view) {
      setViewSection(externalViewRequest.view);
    }
  }, [externalViewRequest]);

  const [birthdayMembers, setBirthdayMembers] = useState<BirthdayMember[]>(() => {
    try {
      const saved = localStorage.getItem(BIRTHDAYS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [tvCarouselSettings, setTvCarouselSettings] = useState<TvCarouselSettings>(() => {
    try {
      const saved = localStorage.getItem(TV_CAROUSEL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            enabled: Boolean(parsed.enabled ?? true),
            intervalSeconds: Number(parsed.intervalSeconds) || 25,
          };
        }
      }
    } catch {
      // ignore
    }
    return { enabled: true, intervalSeconds: 25 };
  });

  const handleUpdateBirthdayMembers = (next: BirthdayMember[]) => {
    setBirthdayMembers(next);
    try {
      localStorage.setItem(BIRTHDAYS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    fetch('/api/team-birthdays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: next, carouselSettings: tvCarouselSettings }),
    }).catch(() => {});
  };

  const handleUpdateTvCarouselSettings = (next: TvCarouselSettings) => {
    setTvCarouselSettings(next);
    try {
      localStorage.setItem(TV_CAROUSEL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    fetch('/api/team-birthdays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: birthdayMembers, carouselSettings: next }),
    }).catch(() => {});
  };
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareTvModalOpen, setShareTvModalOpen] = useState(false);
  const [publicTvUrl, setPublicTvUrl] = useState<string>('');
  const [loadingPublicTvUrl, setLoadingPublicTvUrl] = useState<boolean>(false);
  const [editingGoalModal, setEditingGoalModal] = useState<UnitGoal2027 | null>(null);
  const [isTvMode, setIsTvMode] = useState(() => {
    try {
      return (
        new URLSearchParams(window.location.search).get('tv') === '1' ||
        window.location.hostname.endsWith('.trycloudflare.com')
      );
    } catch {
      return false;
    }
  });
  const [dailyModalUnitId, setDailyModalUnitId] = useState<string | null>(null);
  const [turmaModalUnitId, setTurmaModalUnitId] = useState<string | null>(null);
  const [turmaCountMode, setTurmaCountMode] = useState<'ocupacao_sala' | 'matriculados' | 'todos'>('ocupacao_sala');
  const [onlyWithMatriculados, setOnlyWithMatriculados] = useState<boolean>(true);
  const [bulkCapacityDraft, setBulkCapacityDraft] = useState<string>('');
  const [turmaCapacities, setTurmaCapacities] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('sesi_pe_turma_capacities_2027_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    fetch('/api/public-tv-url')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.publicTvUrl) {
          setPublicTvUrl(data.publicTvUrl);
        }
      })
      .catch(() => {});

    fetch('/api/turma-capacities-2027')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.capacities && typeof data.capacities === 'object') {
          setTurmaCapacities((prev) => {
            const merged = { ...prev, ...data.capacities };
            try {
              localStorage.setItem('sesi_pe_turma_capacities_2027_v1', JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      })
      .catch(() => {});

    fetch('/api/team-birthdays')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          if (Array.isArray(data.members)) {
            setBirthdayMembers(data.members);
            try {
              localStorage.setItem(BIRTHDAYS_STORAGE_KEY, JSON.stringify(data.members));
            } catch {
              // ignore
            }
          }
          if (data.carouselSettings && typeof data.carouselSettings === 'object') {
            const nextSettings: TvCarouselSettings = {
              enabled: Boolean(data.carouselSettings.enabled ?? true),
              intervalSeconds: Number(data.carouselSettings.intervalSeconds) || 25,
            };
            setTvCarouselSettings(nextSettings);
            try {
              localStorage.setItem(TV_CAROUSEL_STORAGE_KEY, JSON.stringify(nextSettings));
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Carrossel Automático no Modo TV: alterna entre Painel de Matrículas ('arena') e Mural de Aniversariantes ('aniversariantes')
  useEffect(() => {
    if (!isTvMode || !tvCarouselSettings.enabled) return;
    const ms = Math.max(10, tvCarouselSettings.intervalSeconds || 25) * 1000;
    const timer = setInterval(() => {
      setViewSection((prev) => (prev === 'aniversariantes' ? 'arena' : 'aniversariantes'));
    }, ms);
    return () => clearInterval(timer);
  }, [isTvMode, tvCarouselSettings.enabled, tvCarouselSettings.intervalSeconds]);

  const handleUpdateTurmaCapacity = (turmaKey: string, rawVal: string) => {
    const cleaned = rawVal.trim();
    const num = cleaned === '' ? 0 : Math.max(0, Math.round(Number(cleaned)));
    setTurmaCapacities((prev) => {
      const next = { ...prev };
      if (!num || Number.isNaN(num)) {
        delete next[turmaKey];
      } else {
        next[turmaKey] = num;
      }
      try {
        localStorage.setItem('sesi_pe_turma_capacities_2027_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      fetch('/api/turma-capacities-2027', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacities: next }),
      }).catch(() => {});
      return next;
    });
  };

  const handleApplyBulkCapacityToUnit = (turmasList: TurmaOccupancyEntry[], capValue: number) => {
    if (Number.isNaN(capValue) || capValue < 0) return;
    setTurmaCapacities((prev) => {
      const next = { ...prev };
      for (const t of turmasList) {
        if (capValue === 0) {
          delete next[t.turmaKey];
        } else {
          next[t.turmaKey] = Math.round(capValue);
        }
      }
      try {
        localStorage.setItem('sesi_pe_turma_capacities_2027_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      fetch('/api/turma-capacities-2027', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacities: next }),
      }).catch(() => {});
      return next;
    });
  };
  const [statusModalTarget, setStatusModalTarget] = useState<{
    unitId: string;
    unitName: string;
    totvsUnitName: string;
    statusType: 'RENOVACAO_PORTAL' | 'INSCRICAO_ONLINE';
  } | null>(null);
  const [emailModalState, setEmailModalState] = useState<{
    open: boolean;
    tab: 'unit' | 'network' | 'whatsapp_directory' | 'history';
    unitId: string | null;
  }>({
    open: false,
    tab: 'unit',
    unitId: null,
  });

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const filteredStatusStudents = useMemo(() => {
    if (!statusModalTarget) return [];
    const targetUnitUpper = statusModalTarget.totvsUnitName.toUpperCase().trim();
    return rows.filter((r) => {
      const rowUnit = String(r['UNIDADE'] ?? '').toUpperCase().trim();
      if (rowUnit !== targetUnitUpper) return false;
      const sit = String(r['SITUACAO MATRICULA'] ?? '').toUpperCase().trim();
      if (sit.includes('CANCELAD')) return false;
      // Mostra os alunos com esse status pendente/específico
      const isEfetivado =
        sit === 'MATRICULADO' ||
        sit === 'PRE MATRICULADO' ||
        sit === 'PRÉ MATRICULADO' ||
        sit === 'PRE-MATRICULADO' ||
        sit === 'PRÉ-MATRICULADO';
      if (isEfetivado) return false;
      if (statusModalTarget.statusType === 'RENOVACAO_PORTAL') {
        return isRenovacaoPortalRow(r);
      }
      return !isRenovacaoPortalRow(r) && isInscricaoOnlineRow(r);
    });
  }, [rows, statusModalTarget]);

  const { units, totals } = useMemo(
    () => computeNetworkMetrics2027(rows, goals, 'efetivados'),
    [rows, goals]
  );

  const rankedUnits = useMemo(() => {
    return [...units].sort((a, b) => {
      if (rankBy === 'pct') {
        return b.pctGeral - a.pctGeral || b.realTotal - a.realTotal;
      }
      return b.realTotal - a.realTotal || b.pctGeral - a.pctGeral;
    });
  }, [units, rankBy]);

  const top3Units = rankedUnits.slice(0, 3);

  const selectedDailyTarget = useMemo(() => {
    if (!dailyModalUnitId) return null;
    if (dailyModalUnitId === 'ALL') {
      return {
        id: 'ALL',
        title: 'Rede SESI-PE (Todas as 12 Escolas)',
        totvsUnitName: '',
        realTotal: totals.realTotal,
        metaGeral: totals.metaGeral,
        pctGeral: totals.pctGeral,
        faltamParaMeta: totals.faltamParaMeta,
        diasComMatricula: totals.diasComMatricula,
        mediaPorDiaAtivo: totals.mediaPorDiaAtivo,
        picoDia: totals.picoDia,
        ultimoDia: totals.ultimoDia,
        metaDiariaAte31Dez: totals.metaDiariaAte31Dez,
        dailyProductivity: totals.dailyProductivity,
      };
    }
    const found = units.find((u) => u.goal.id === dailyModalUnitId);
    if (!found) return null;
    return {
      id: found.goal.id,
      title: `Escola SESI ${found.goal.shortName}`,
      totvsUnitName: found.goal.totvsUnitName,
      realTotal: found.realTotal,
      metaGeral: found.goal.metaGeral,
      pctGeral: found.pctGeral,
      faltamParaMeta: found.faltamParaMeta,
      diasComMatricula: found.diasComMatricula,
      mediaPorDiaAtivo: found.mediaPorDiaAtivo,
      picoDia: found.picoDia,
      ultimoDia: found.ultimoDia,
      metaDiariaAte31Dez: found.metaDiariaAte31Dez,
      dailyProductivity: found.dailyProductivity,
    };
  }, [dailyModalUnitId, units, totals]);

  const handleSharePublicLink = async () => {
    setShareTvModalOpen(true);
    if (publicTvUrl) {
      try {
        await navigator.clipboard.writeText(publicTvUrl);
      } catch {
        // ignore
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3500);
      return;
    }

    setLoadingPublicTvUrl(true);
    try {
      const res = await fetch('/api/public-tv-url');
      const data = await res.json();
      const resolvedUrl = data?.ok && data.publicTvUrl ? data.publicTvUrl : getPublicTvShareUrl();
      setPublicTvUrl(resolvedUrl);
      try {
        await navigator.clipboard.writeText(resolvedUrl);
      } catch {
        // ignore
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3500);
    } catch {
      const fallback = getPublicTvShareUrl();
      setPublicTvUrl(fallback);
    } finally {
      setLoadingPublicTvUrl(false);
    }
  };

  const handleToggleFullscreen = () => {
    const nextTv = !isTvMode;
    setIsTvMode(nextTv);
    if (nextTv) {
      setViewSection('arena');
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  return (
    <div
      className={
        isTvMode
          ? 'fixed inset-0 z-40 overflow-y-auto bg-[#F4F9FD] bg-[radial-gradient(#bae6fd_1.25px,transparent_1.25px)] bg-[size:24px_24px] text-slate-800 pb-4'
          : 'min-h-full bg-[#F4F9FD] bg-[radial-gradient(#bae6fd_1.25px,transparent_1.25px)] bg-[size:24px_24px] text-slate-800 pb-12'
      }
    >
      {/* Barra de Controles Escolar / Gestão à Vista (Fundo Claro e Alegre) */}
      <div className="border-b border-sky-200 bg-white/95 backdrop-blur-xs">
        <div
          className={`max-w-[1600px] mx-auto px-4 sm:px-6 ${
            isTvMode ? 'py-1.5' : 'py-2.5'
          } flex flex-wrap items-center justify-between gap-2`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-extrabold text-[#009FE3]">
              Critério Oficial:
            </span>
            <span className="font-semibold text-slate-700">
              Apenas <strong className="text-emerald-700">Matriculado</strong> ou{' '}
              <strong className="text-emerald-700">Pré-Matriculado</strong>
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onForceSync}
              disabled={isAutoSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-60"
              title="Sincronização automática a cada 60 minutos com o TOTVS RM (novas matrículas piscam em verde por 5 min). Clique para sincronizar agora."
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isAutoSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isAutoSyncing
                  ? 'Sincronizando TOTVS...'
                  : `Auto-Sync (60m): ${formatCountdown(nextSyncSeconds)}`}
              </span>
              {lastSyncTime && !isAutoSyncing && (
                <span className="text-[10px] text-emerald-700 font-mono">
                  (Últ: {lastSyncTime})
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDailyModalUnitId('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-900 bg-indigo-50 border-2 border-b-4 border-indigo-300 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap"
              title="Ver produtividade diária de matrículas de toda a Rede SESI-PE"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-700" />
              Produtividade / Dia (Rede)
            </button>
            <button
              type="button"
              onClick={onResetUnitGoals}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
              title="Restaurar metas para os valores originais da planilha (9.357)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Metas
            </button>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setViewSection('ambos')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  viewSection === 'ambos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mural + Planilha
              </button>
              <button
                type="button"
                onClick={() => setViewSection('arena')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  viewSection === 'arena'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mural 12 Escolas
              </button>
              <button
                type="button"
                onClick={() => setViewSection('planilha')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  viewSection === 'planilha'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Planilha Oficial
              </button>
              <button
                type="button"
                onClick={() => setViewSection('aniversariantes')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  viewSection === 'aniversariantes'
                    ? 'bg-amber-300 text-amber-950 shadow-xs'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                }`}
                title="Abrir Mural de Aniversariantes do Mês da Equipe (com fotos e carrossel na TV)"
              >
                <Cake className="w-3.5 h-3.5 text-amber-700" />
                <span>Aniversariantes ({birthdayMembers.length})</span>
              </button>
            </div>

            {isTvMode && (
              <button
                type="button"
                onClick={() =>
                  handleUpdateTvCarouselSettings({
                    ...tvCarouselSettings,
                    enabled: !tvCarouselSettings.enabled,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold rounded-xl border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  tvCarouselSettings.enabled
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
                title="Alternar automaticamente na TV entre o Painel de Matrículas e o Mural de Aniversariantes do Mês"
              >
                {tvCarouselSettings.enabled ? (
                  <Play className="w-3 h-3 text-emerald-700 fill-current" />
                ) : (
                  <Pause className="w-3 h-3 text-slate-500" />
                )}
                <span>
                  Carrossel TV:{' '}
                  {tvCarouselSettings.enabled
                    ? `Ativo (${tvCarouselSettings.intervalSeconds}s)`
                    : 'Pausado'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setEmailModalState({
                  open: true,
                  tab: 'network',
                  unitId: units[0]?.goal.id ?? null,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#009FE3] border-2 border-b-4 border-sky-700 rounded-xl hover:bg-sky-600 transition-colors whitespace-nowrap cursor-pointer"
              title="Visualizar, enviar por WhatsApp, imprimir em PDF e salvar relatórios por unidade e consolidado da rede"
            >
              <FileText className="w-3.5 h-3.5" />
              Relatórios (Unidades / Rede)
            </button>

            <button
              type="button"
              onClick={() =>
                setEmailModalState({
                  open: true,
                  tab: 'whatsapp_directory',
                  unitId: units[0]?.goal.id ?? null,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#25D366] border-2 border-b-4 border-emerald-700 rounded-xl hover:bg-[#1ebe5d] transition-colors whitespace-nowrap cursor-pointer"
              title="Cadastrar o número de WhatsApp de cada uma das 12 unidades escolares e enviar relatórios pelo WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Unidades
            </button>

            {isAdmin && onOpenAccessControl && !isTvMode && (
              <button
                type="button"
                onClick={onOpenAccessControl}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl border-2 border-b-4 transition-colors whitespace-nowrap cursor-pointer ${
                  pendingApprovalsCount > 0
                    ? 'bg-amber-300 text-amber-950 border-amber-500 animate-pulse'
                    : 'bg-slate-800 text-white border-slate-950 hover:bg-slate-700'
                }`}
                title="Gerenciar e aprovar solicitações de login Google (Administrador: maykon.euro@hotmail.com)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  Aprovar Acessos{pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ''}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSharePublicLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 border-2 border-b-4 border-emerald-400 rounded-xl hover:bg-emerald-200/80 transition-colors whitespace-nowrap"
              title="Copiar link direto para compartilhamento sem necessidade de login"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-emerald-700" />
              )}
              {copiedLink ? 'Link Copiado!' : 'Compartilhar'}
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-b-4 transition-colors whitespace-nowrap ${
                isTvMode
                  ? 'bg-amber-300 text-amber-950 border-amber-500 hover:bg-amber-200'
                  : 'text-sky-900 bg-sky-100 border-sky-300 hover:bg-sky-200/80'
              }`}
              title="Ajustar visão compacta One-Page para TV / Gestão à Vista na Escola"
            >
              {isTvMode ? (
                <Minimize2 className="w-3.5 h-3.5 text-amber-900" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-sky-700" />
              )}
              {isTvMode ? 'Sair Modo TV (One-Page)' : 'Modo TV Escolar (One-Page)'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`max-w-[1600px] mx-auto px-4 sm:px-6 ${
          isTvMode ? 'pt-2 space-y-2.5' : 'pt-4 space-y-5'
        }`}
      >
        {/* SEÇÃO NOVA: MURAL DE ANIVERSARIANTES DO MÊS (EQUIPE SESI-PE) */}
        {viewSection === 'aniversariantes' && (
          <TeamBirthdaysMural
            members={birthdayMembers}
            onChangeMembers={handleUpdateBirthdayMembers}
            carouselSettings={tvCarouselSettings}
            onChangeCarouselSettings={handleUpdateTvCarouselSettings}
            isTvMode={isTvMode}
            onSwitchToEnrollments={() => setViewSection(isTvMode ? 'arena' : 'ambos')}
          />
        )}

        {/* 1. CABEÇALHO DO MURAL ESCOLAR — CAMPANHA DE MATRÍCULAS SESI-PE 2027 */}
        {viewSection !== 'aniversariantes' && (
        <section className={isTvMode ? 'space-y-2' : 'space-y-3.5'}>
          <div
            className={`rounded-2xl bg-white border-2 border-b-4 border-sky-300 ${
              isTvMode ? 'p-3 sm:px-5 sm:py-2.5' : 'p-4 sm:p-5'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 max-w-3xl">
                <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-[#009FE3] tracking-wide">
                  <GraduationCap className="w-3.5 h-3.5 text-[#009FE3]" />
                  <span>REDE SESI EDUCAÇÃO DE PERNAMBUCO</span>
                  <span aria-hidden="true">·</span>
                  <span>CRONOGRAMA: 08 DE SETEMBRO A 31 DE DEZEMBRO</span>
                </div>
                <h1
                  className={`${
                    isTvMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                  } font-extrabold tracking-tight text-slate-900`}
                >
                  Mural Escolar & Campanha de Matrículas 2027
                </h1>
                {!isTvMode && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Escala da campanha contabilizando exclusivamente as{' '}
                    <strong className="text-slate-900">
                      Matrículas Pagas ({totals.metaPagasTotal.toLocaleString('pt-BR')} alunos entre Veteranos e Novatos)
                    </strong>{' '}
                    com situação <strong className="text-emerald-700">Matriculado ou Pré-Matriculado</strong>{' '}
                    <span className="text-slate-500">
                      (Meta Geral c/ Gratuidade: {totals.metaGeral.toLocaleString('pt-BR')} · Reserva e Renovação via Portal não contam como efetivados).
                    </span>
                  </p>
                )}
              </div>

              {/* Placar Geral da Rede (Matriculados + Pré-Matriculados sobre a Escala de 7.304 Alunos) */}
              <div
                className={`grid grid-cols-4 divide-x divide-sky-200 bg-sky-50/70 rounded-xl ${
                  isTvMode ? 'py-1.5 px-1' : 'py-2.5 px-2'
                }`}
              >
                <div className="px-3 sm:px-4 text-center" title={`Total de Alunos Matriculados + Pré-Matriculados: ${totals.realTotal.toLocaleString('pt-BR')}`}>
                  <div className="text-[10px] font-bold text-sky-800">
                    Matriculados
                  </div>
                  <div
                    className={`${
                      isTvMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    } font-extrabold font-mono tabular-nums text-[#009FE3]`}
                  >
                    {totals.realTotal.toLocaleString('pt-BR')}
                  </div>
                </div>

                <div
                  onClick={() => {
                    const el = document.getElementById('quadro-oficial-metas');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    else setViewSection('ambos');
                  }}
                  title={`Meta da Escala (Veteranos + Novatos Pagos): ${totals.metaPagasTotal.toLocaleString('pt-BR')} (Veteranos: ${totals.metaPagasRenovacoes.toLocaleString('pt-BR')} + Novatos: ${totals.metaPagasNovatos2027.toLocaleString('pt-BR')})`}
                  className="px-3 sm:px-4 text-center cursor-pointer group"
                >
                  <div className="text-[10px] font-bold text-emerald-800 flex items-center justify-center gap-1">
                    <span>Meta Escala</span>
                    <Pencil className="w-2.5 h-2.5 text-emerald-600 opacity-75 group-hover:opacity-100" />
                  </div>
                  <div
                    className={`${
                      isTvMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    } font-extrabold font-mono tabular-nums text-emerald-700 group-hover:underline decoration-dashed underline-offset-4`}
                  >
                    {totals.metaPagasTotal.toLocaleString('pt-BR')}
                  </div>
                </div>

                <div className="px-3 sm:px-4 text-center">
                  <div className="text-[10px] font-bold text-amber-800">
                    Atingimento
                  </div>
                  <div
                    className={`${
                      isTvMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    } font-extrabold font-mono tabular-nums text-amber-600`}
                  >
                    {totals.pctPagasTotal.toFixed(1)}%
                  </div>
                </div>

                <div
                  onClick={() => setDailyModalUnitId('ALL')}
                  title="Clique para abrir a produtividade diária detalhada da Rede"
                  className="px-3 sm:px-4 text-center cursor-pointer group"
                >
                  <div className="text-[10px] font-bold text-indigo-800 flex items-center justify-center gap-1">
                    <span>Média / Dia</span>
                    <BarChart3 className="w-2.5 h-2.5 text-indigo-600" />
                  </div>
                  <div
                    className={`${
                      isTvMode ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    } font-extrabold font-mono tabular-nums text-indigo-700 group-hover:underline`}
                  >
                    {totals.mediaPorDiaAtivo.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Escala / Linha do Tempo da Campanha de Matrículas 2027 (08 de Setembro a 31 de Dezembro · Total 7.304 Alunos) */}
            <div className={`${isTvMode ? 'mt-2 pt-2 space-y-1' : 'mt-3.5 pt-3 border-t border-sky-100 space-y-1.5'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-sky-950 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#009FE3]" />
                  ESCALA DE MATRÍCULAS (08 DE SETEMBRO A 31 DE DEZEMBRO): {totals.realTotal.toLocaleString('pt-BR')} DE {totals.metaPagasTotal.toLocaleString('pt-BR')} ALUNOS (VETERANOS + NOVATOS)
                </span>
                <span className="text-amber-700 font-mono tabular-nums">
                  Faltam {totals.faltamPagasParaMeta.toLocaleString('pt-BR')} alunos ({totals.metaDiariaPagasAte31Dez.toFixed(1)}/dia até 31/12)
                </span>
              </div>

              <div className={`relative ${isTvMode ? 'h-3.5' : 'h-4'} w-full bg-sky-100 rounded-full overflow-hidden p-0.5`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#009FE3] via-teal-400 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(2, totals.pctPagasTotal))}%` }}
                />
                <div className="absolute inset-y-0 left-1/4 w-0.5 bg-white/80" />
                <div className="absolute inset-y-0 left-2/4 w-0.5 bg-white/80" />
                <div className="absolute inset-y-0 left-3/4 w-0.5 bg-white/80" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-600 font-mono tabular-nums">
                <span className="text-[#009FE3]">Início: 08 de Setembro (0%)</span>
                <span>Outubro · 25% ({Math.round(totals.metaPagasTotal * 0.25).toLocaleString('pt-BR')})</span>
                <span>Novembro · 50% ({Math.round(totals.metaPagasTotal * 0.5).toLocaleString('pt-BR')})</span>
                <span>Dezembro · 75% ({Math.round(totals.metaPagasTotal * 0.75).toLocaleString('pt-BR')})</span>
                <span className="text-emerald-700">Meta Final: 31 de Dezembro · 100% ({totals.metaPagasTotal.toLocaleString('pt-BR')} Alunos Pagantes)</span>
              </div>
            </div>
          </div>

          {/* Os 4 Desafios Escolares da Campanha 2027 (Compactos para caber em One-Page) */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
            {/* Desafio 1: Matrículas Pagas Novatos 2027 */}
            <div className={`${isTvMode ? 'p-2.5 space-y-1' : 'p-3.5 space-y-1.5'} rounded-2xl bg-white border-2 border-b-4 border-sky-300`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-sky-900">
                  01. Novatos Pagantes 2027
                </span>
                <GraduationCap className="w-4 h-4 text-[#009FE3]" />
              </div>
              <div className="flex items-baseline justify-between font-mono tabular-nums">
                <span className={`${isTvMode ? 'text-lg' : 'text-xl'} font-extrabold text-slate-900`}>
                  {totals.realPagasNovatos.toLocaleString('pt-BR')}{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    / {totals.metaPagasNovatos2027.toLocaleString('pt-BR')}
                  </span>
                </span>
                <span className="text-xs font-extrabold text-[#009FE3]">
                  {totals.pctPagasNovatos.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-sky-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#009FE3] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, totals.pctPagasNovatos)}%` }}
                />
              </div>
            </div>

            {/* Desafio 2: Matrículas Pagas Renovações */}
            <div className={`${isTvMode ? 'p-2.5 space-y-1' : 'p-3.5 space-y-1.5'} rounded-2xl bg-white border-2 border-b-4 border-emerald-300`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-900">
                  02. Renovações Pagas (Veteranos)
                </span>
                <BookOpen className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between font-mono tabular-nums">
                <span className={`${isTvMode ? 'text-lg' : 'text-xl'} font-extrabold text-slate-900`}>
                  {totals.realPagasRenovacoes.toLocaleString('pt-BR')}{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    / {totals.metaPagasRenovacoes.toLocaleString('pt-BR')}
                  </span>
                </span>
                <span className="text-xs font-extrabold text-emerald-700">
                  {totals.pctPagasRenovacoes.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, totals.pctPagasRenovacoes)}%` }}
                />
              </div>
            </div>

            {/* Desafio 3: Gratuidade Remanescente */}
            <div className={`${isTvMode ? 'p-2.5 space-y-1' : 'p-3.5 space-y-1.5'} rounded-2xl bg-white border-2 border-b-4 border-amber-300`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-900">
                  03. Gratuidade Remanescente
                </span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline justify-between font-mono tabular-nums">
                <span className={`${isTvMode ? 'text-lg' : 'text-xl'} font-extrabold text-slate-900`}>
                  {totals.realGratuidadeRemanescente.toLocaleString('pt-BR')}{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    / {totals.metaGratuidadeRemanescente.toLocaleString('pt-BR')}
                  </span>
                </span>
                <span className="text-xs font-extrabold text-amber-700">
                  {totals.pctGratuidadeRem.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, totals.pctGratuidadeRem)}%` }}
                />
              </div>
            </div>

            {/* Desafio 4: Novas Vagas Gratuidade 2027 */}
            <div className={`${isTvMode ? 'p-2.5 space-y-1' : 'p-3.5 space-y-1.5'} rounded-2xl bg-white border-2 border-b-4 border-orange-300`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-orange-900">
                  04. Novas Gratuidade 2027
                </span>
                <Star className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex items-baseline justify-between font-mono tabular-nums">
                <span className={`${isTvMode ? 'text-lg' : 'text-xl'} font-extrabold text-slate-900`}>
                  {totals.realNovasGratuidade.toLocaleString('pt-BR')}{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    / {totals.metaNovasGratuidade2027.toLocaleString('pt-BR')}
                  </span>
                </span>
                <span className="text-xs font-extrabold text-orange-600">
                  {totals.pctNovasGratuidade.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-orange-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, totals.pctNovasGratuidade)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
        )}

        {/* 2. QUADRO DE HONRA (PÓDIO ESCOLAR) & MURAL DAS 12 ESCOLAS SESI-PE */}
        {(viewSection === 'ambos' || viewSection === 'arena') && (
          <section className={isTvMode ? 'space-y-2' : 'space-y-3.5'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h2 className={`${isTvMode ? 'text-base' : 'text-lg'} font-extrabold text-slate-900 flex items-center gap-1.5`}>
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Mural das 12 Escolas SESI-PE & Produtividade Diária
                </h2>
                {!isTvMode && (
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    (Clique em <strong>Produtividade / Dia</strong> em qualquer card para ver as matrículas realizadas por dia)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Ordenar por:</span>
                <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRankBy('pct')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      rankBy === 'pct'
                        ? 'bg-[#009FE3] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    % da Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankBy('volume')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      rankBy === 'volume'
                        ? 'bg-[#009FE3] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Volume Total
                  </button>
                </div>
              </div>
            </div>

            {/* Pódio Escolar Top 3 Unidades (Oculto no Modo TV One-Page para caber as 12 escolas na tela única) */}
            {!isTvMode && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {top3Units.map((u, idx) => {
                  const podiumStyle = [
                    {
                      medal: '1º LUGAR · MEDALHA DE OURO',
                      cardBg: 'bg-gradient-to-br from-amber-50 via-yellow-50/70 to-white',
                      border: 'border-amber-300',
                      textAccent: 'text-amber-700',
                      bar: 'from-amber-400 to-yellow-500',
                    },
                    {
                      medal: '2º LUGAR · MEDALHA DE PRATA',
                      cardBg: 'bg-gradient-to-br from-slate-100 via-sky-50/40 to-white',
                      border: 'border-slate-300',
                      textAccent: 'text-slate-700',
                      bar: 'from-sky-400 to-blue-500',
                    },
                    {
                      medal: '3º LUGAR · MEDALHA DE BRONZE',
                      cardBg: 'bg-gradient-to-br from-orange-50 via-amber-50/40 to-white',
                      border: 'border-orange-300',
                      textAccent: 'text-orange-700',
                      bar: 'from-orange-400 to-amber-500',
                    },
                  ][idx];

                  return (
                    <div
                      key={u.goal.id}
                      onClick={() => setDailyModalUnitId(u.goal.id)}
                      className={`cursor-pointer rounded-2xl ${podiumStyle.cardBg} border-2 border-b-4 ${podiumStyle.border} p-3.5 transition-transform duration-150 hover:-translate-y-0.5 shadow-xs`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={podiumStyle.textAccent}>
                          {podiumStyle.medal}
                        </span>
                        <span className="text-slate-500 font-mono">
                          Média: {u.mediaPorDiaAtivo.toFixed(1)}/dia
                        </span>
                      </div>

                      <div className="mt-1 flex items-baseline justify-between">
                        <h3 className="text-base font-extrabold text-slate-900">
                          Escola SESI {u.goal.shortName}
                        </h3>
                        <span className={`text-xl font-extrabold font-mono tabular-nums ${podiumStyle.textAccent}`}>
                          {u.pctGeral.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-2 h-2.5 w-full bg-white/90 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${podiumStyle.bar}`}
                          style={{ width: `${Math.min(100, Math.max(3, u.pctGeral))}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold font-mono tabular-nums text-slate-600">
                        <span>
                          Alunos: <strong className="text-slate-900">{u.realTotal}</strong>{' '}
                          <InlineGoalEditor
                            prefix="/ "
                            value={u.goal.metaGeral}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'metaGeral', val)
                            }
                          />
                        </span>
                        <span className="text-indigo-700 font-bold">
                          Pico: {u.picoDia ? `${u.picoDia.total} (${u.picoDia.shortDate})` : '0'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cards das 12 Escolas SESI-PE (Grade 4x3 Compacta para caber em One-Page / Modo TV) */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                isTvMode ? 'gap-2' : 'gap-3'
              }`}
            >
              {rankedUnits.map((u, index) => {
                const newEnrollmentsDiff = flashingUnits[u.goal.id] || 0;
                const isFlashingGreen = newEnrollmentsDiff > 0;

                return (
                  <div
                    key={u.goal.id}
                    onClick={() => {
                      if (isFlashingGreen) onDismissFlash(u.goal.id);
                    }}
                    className={`rounded-2xl bg-white border-2 border-b-4 ${
                      isFlashingGreen
                        ? 'border-emerald-500 ring-4 ring-emerald-400/80 animate-pulse bg-emerald-50/30 shadow-lg shadow-emerald-500/20'
                        : u.leagueTier.borderClass
                    } ${
                      isTvMode ? 'p-2.5 gap-1.5' : 'p-3 gap-2'
                    } flex flex-col justify-between hover:border-[#009FE3] transition-all shadow-xs`}
                  >
                    <div>
                      {/* Cabeçalho Compacto da Escola */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-mono font-extrabold text-[#009FE3]">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                          <School className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">
                            SESI {u.goal.shortName}
                          </h3>
                        </div>
                        {isFlashingGreen ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-extrabold shrink-0 animate-bounce">
                            +{newEnrollmentsDiff} NOVA{newEnrollmentsDiff > 1 ? 'S' : ''}!
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${u.leagueTier.colorClass}`}>
                            {u.leagueTier.badgeText}
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso Principal da Escola */}
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-baseline justify-between text-[11px] font-mono tabular-nums">
                          <span className="text-slate-600 font-medium">
                            Matrículas: <strong className="text-slate-900 text-xs">{u.realTotal}</strong>{' '}
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.metaGeral}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'metaGeral', val)
                              }
                              className="font-bold text-slate-800"
                            />
                          </span>
                          <span className="font-extrabold text-[#009FE3]">
                            {u.pctGeral.toFixed(1)}% <span className="text-slate-400 font-normal">(-{u.faltamParaMeta})</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${u.leagueTier.barClass} transition-all duration-300`}
                            style={{ width: `${Math.min(100, Math.max(2, u.pctGeral))}%` }}
                          />
                        </div>
                      </div>

                      {/* As 4 Sub-Metas Compactas da Escola */}
                      <div
                        className={`mt-2 grid grid-cols-2 ${
                          isTvMode ? 'gap-1 pt-1.5' : 'gap-1.5 pt-2'
                        } border-t border-slate-100 text-[11px]`}
                      >
                        {/* 1. Pagas Novatos */}
                        <div className="px-2 py-1 rounded-lg bg-sky-50/80">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-sky-900">
                            <span className="truncate">Novatos Pagos</span>
                            <span className="font-mono text-[#009FE3] font-bold">
                              {u.pctPagasNovatos.toFixed(0)}%
                            </span>
                          </div>
                          <div className="font-mono font-extrabold text-slate-900 tabular-nums text-[11px]">
                            {u.realPagasNovatos}{' '}
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.pagasNovatos2027}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'pagasNovatos2027', val)
                              }
                              className="text-slate-600 font-semibold"
                            />
                          </div>
                        </div>

                        {/* 2. Pagas Renovações */}
                        <div className="px-2 py-1 rounded-lg bg-emerald-50/80">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-900">
                            <span className="truncate">Renovações</span>
                            <span className="font-mono text-emerald-700 font-bold">
                              {u.pctPagasRenovacoes.toFixed(0)}%
                            </span>
                          </div>
                          <div className="font-mono font-extrabold text-slate-900 tabular-nums text-[11px]">
                            {u.realPagasRenovacoes}{' '}
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.pagasRenovacoes}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'pagasRenovacoes', val)
                              }
                              className="text-slate-600 font-semibold"
                            />
                          </div>
                        </div>

                        {/* 3. Gratuidade Remanescente */}
                        <div className="px-2 py-1 rounded-lg bg-amber-50/80">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900">
                            <span className="truncate">Grat. Reman.</span>
                            <span className="font-mono text-amber-700 font-bold">
                              {u.pctGratuidadeRem.toFixed(0)}%
                            </span>
                          </div>
                          <div className="font-mono font-extrabold text-slate-900 tabular-nums text-[11px]">
                            {u.realGratuidadeRemanescente}{' '}
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.gratuidadeRemanescente}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'gratuidadeRemanescente', val)
                              }
                              className="text-slate-600 font-semibold"
                            />
                          </div>
                        </div>

                        {/* 4. Novas Gratuidade */}
                        <div className="px-2 py-1 rounded-lg bg-orange-50/80">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-orange-900">
                            <span className="truncate">Novas Grat.</span>
                            <span className="font-mono text-orange-700 font-bold">
                              {u.pctNovasGratuidade.toFixed(0)}%
                            </span>
                          </div>
                          <div className="font-mono font-extrabold text-slate-900 tabular-nums text-[11px]">
                            {u.realNovasGratuidade}{' '}
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.novasVagasGratuidade2027}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'novasVagasGratuidade2027', val)
                              }
                              className="text-slate-600 font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Links de Status e Ocupação: Renovação via Portal, Inscrição Online e Ocupação da Turma */}
                      <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1 text-[10px]">
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusModalTarget({
                                unitId: u.goal.id,
                                unitName: `Escola SESI ${u.goal.shortName}`,
                                totvsUnitName: u.goal.totvsUnitName,
                                statusType: 'RENOVACAO_PORTAL',
                              });
                            }}
                            className="flex-1 flex items-center justify-between px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-900 font-bold transition-colors cursor-pointer"
                            title="Clique para ver os alunos com status Renovação via Portal"
                          >
                            <span className="truncate underline decoration-violet-400 underline-offset-2">
                              Renovação via Portal
                            </span>
                            <span className="ml-1 font-mono font-extrabold text-violet-700">
                              ({u.renovacaoPortalCount})
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusModalTarget({
                                unitId: u.goal.id,
                                unitName: `Escola SESI ${u.goal.shortName}`,
                                totvsUnitName: u.goal.totvsUnitName,
                                statusType: 'INSCRICAO_ONLINE',
                              });
                            }}
                            className="flex-1 flex items-center justify-between px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold transition-colors cursor-pointer"
                            title="Clique para ver os alunos com status Inscrição Online / Reserva"
                          >
                            <span className="truncate underline decoration-teal-400 underline-offset-2">
                              Inscrição Online
                            </span>
                            <span className="ml-1 font-mono font-extrabold text-teal-700">
                              ({u.inscricaoOnlineCount})
                            </span>
                          </button>
                        </div>

                        {(() => {
                          const activeTurmas = u.turmas.filter((t) => t.ocupacaoComReservada > 0);
                          const unitOcupacaoSala = activeTurmas.reduce(
                            (acc, t) => acc + t.ocupacaoComReservada,
                            0
                          );
                          const unitReservadas = activeTurmas.reduce(
                            (acc, t) => acc + t.matriculaReservada,
                            0
                          );
                          const unitTurmasMax = activeTurmas.reduce(
                            (acc, t) => acc + (turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0),
                            0
                          );
                          const unitTurmasPct =
                            unitTurmasMax > 0 ? (unitOcupacaoSala / unitTurmasMax) * 100 : 0;

                          return (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTurmaModalUnitId(u.goal.id);
                                }}
                                className="flex-1 flex items-center justify-between px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-950 font-bold transition-colors cursor-pointer border border-sky-200/80"
                                title={`Ocupação de Sala: ${u.realTotal} Matriculados + ${unitReservadas} Matrículas Reservadas (vaga garantida até 31/12, não conta como matriculado) = ${unitOcupacaoSala} / ${unitTurmasMax} Máx. Alunos`}
                              >
                                <span className="inline-flex items-center gap-1 truncate underline decoration-sky-400 underline-offset-2">
                                  <Users className="w-3 h-3 text-[#009FE3] shrink-0" />
                                  Ocupação da Turma
                                </span>
                                <span className="ml-1 font-mono font-extrabold text-[#009FE3] shrink-0">
                                  {unitTurmasMax > 0
                                    ? `${unitTurmasPct.toFixed(1)}% (${unitOcupacaoSala}/${unitTurmasMax})`
                                    : `(${activeTurmas.length || u.turmas.length}t)`}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmailModalState({
                                    open: true,
                                    tab: 'unit',
                                    unitId: u.goal.id,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold transition-colors cursor-pointer border border-emerald-200/80 shrink-0"
                                title={`Enviar por WhatsApp, visualizar ou baixar relatório de SESI ${u.goal.shortName}`}
                              >
                                <MessageCircle className="w-3 h-3 text-[#25D366] shrink-0" />
                                <span>Relatório / WhatsApp</span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Rodapé da Escola com Links: Produtividade + Metas + Mostrar Alunos */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDailyModalUnitId(u.goal.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 hover:text-indigo-900 underline decoration-indigo-300 underline-offset-2 transition-colors whitespace-nowrap cursor-pointer"
                        title="Clique para ver a quantidade de matrículas realizadas por dia (Produtividade)"
                      >
                        <BarChart3 className="w-3 h-3" />
                        Produtividade
                      </button>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGoalModal({ ...u.goal });
                          }}
                          className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700 hover:text-amber-800 transition-colors whitespace-nowrap cursor-pointer"
                          title="Ajustar metas da escola"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          Metas
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectUnitInGrid(u.goal.totvsUnitName);
                          }}
                          className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#009FE3] hover:text-sky-700 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Mostrar Alunos
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. QUADRO CONSOLIDADO OFICIAL (CORES FIÉIS À PLANILHA SESI EDUCAÇÃO PE) */}
        {(viewSection === 'ambos' || viewSection === 'planilha') && (
          <section id="quadro-oficial-metas" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#009FE3]" />
                  Quadro Oficial: Consolidado de Metas x Realizado por Unidade (2027)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Clique em qualquer valor de <strong>Meta</strong> na tabela abaixo para ajustar a meta da escola instantaneamente.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-b-8 border-sky-300 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#00A3E0] text-white font-extrabold text-center border-b border-sky-600 text-sm">
                      <th colSpan={8} className="py-2.5 px-4 tracking-wide">
                        REDE SESI EDUCAÇÃO DE PERNAMBUCO - MATRÍCULAS 2027
                      </th>
                    </tr>
                    <tr className="text-center font-bold border-b border-slate-300">
                      <th
                        colSpan={3}
                        className="py-2 px-4 bg-[#00A3E0] text-white border-r border-sky-600"
                      >
                        CONSOLIDADO DE METAS DE MATRÍCULAS POR UNIDADE
                      </th>
                      <th
                        colSpan={3}
                        className="py-2 px-4 bg-slate-200 text-slate-800 border-r border-slate-300"
                      >
                        DETALHAMENTO DAS METAS (REALIZADO / META)
                      </th>
                      <th className="py-2 px-4 bg-slate-200 text-slate-900 border-r border-slate-300">
                        META GERAL
                      </th>
                      <th className="py-2 px-4 bg-[#00A3E0] text-white">
                        OBSERVAÇÕES
                      </th>
                    </tr>
                    <tr className="border-b-2 border-slate-300 font-bold text-slate-800">
                      <th className="py-3 px-4 bg-[#00A3E0] text-white border-r border-sky-600">
                        UNIDADE ESCOLAR
                      </th>
                      <th className="py-3 px-3 text-right bg-[#00A3E0] text-white border-r border-sky-600">
                        META DE MATRÍCULAS UNIDADE 2027
                      </th>
                      <th className="py-3 px-3 text-right bg-[#00A3E0] text-white border-r border-sky-600">
                        GRATUIDADE REMANESCENTE
                        <div className="text-[10px] font-normal text-sky-100">Real / Meta</div>
                      </th>
                      <th className="py-3 px-3 text-right bg-slate-100 border-r border-slate-300">
                        MATRÍCULAS PAGAS RENOVAÇÕES
                        <div className="text-[10px] font-normal text-slate-500">Real / Meta</div>
                      </th>
                      <th className="py-3 px-3 text-right bg-slate-100 border-r border-slate-300">
                        MATRÍCULAS PAGAS NOVATOS 2027
                        <div className="text-[10px] font-normal text-[#009FE3]">Novato (Mat/Pré)</div>
                      </th>
                      <th className="py-3 px-3 text-right bg-slate-100 border-r border-slate-300">
                        NOVAS VAGAS GRATUIDADE 2027
                        <div className="text-[10px] font-normal text-slate-500">Real / Meta</div>
                      </th>
                      <th className="py-3 px-4 text-right bg-slate-100 border-r border-slate-300">
                        PAGO + NOVA GRAT. + GRAT. REMANESC.
                        <div className="text-[10px] font-normal text-emerald-700">Real / Meta (%)</div>
                      </th>
                      <th className="py-3 px-4 bg-[#00A3E0] text-white min-w-[200px]">
                        OBSERVAÇÕES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {units.map((u) => (
                      <tr
                        key={u.goal.id}
                        className="hover:bg-sky-50/60 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900 bg-white border-r border-slate-200 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onInspectUnitInGrid(u.goal.totvsUnitName)}
                            className="hover:text-[#009FE3] transition-colors text-left flex items-center gap-1.5"
                          >
                            <span>{u.goal.shortName}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#009FE3]" />
                          </button>
                        </td>

                        {/* Meta de Matrículas Unidade 2027 (Verde claro fiel à planilha) */}
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-900 bg-[#D9F2D9] border-r border-slate-300">
                          <InlineGoalEditor
                            value={u.goal.metaUnidade2027}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'metaUnidade2027', val)
                            }
                            className="font-bold text-emerald-950"
                          />
                        </td>

                        {/* Gratuidade Remanescente */}
                        <td className="py-2.5 px-3 text-right bg-[#D9F2D9]/60 border-r border-slate-300">
                          <span className="font-extrabold text-slate-900">
                            {u.realGratuidadeRemanescente}
                          </span>{' '}
                          <InlineGoalEditor
                            prefix="/ "
                            value={u.goal.gratuidadeRemanescente}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'gratuidadeRemanescente', val)
                            }
                            className="text-slate-700 font-semibold"
                          />
                          <span className="ml-1.5 text-[11px] font-bold text-amber-700">
                            ({u.pctGratuidadeRem.toFixed(0)}%)
                          </span>
                        </td>

                        {/* Matrículas Pagas Renovações */}
                        <td className="py-2.5 px-3 text-right bg-[#D9F2D9]/60 border-r border-slate-300">
                          <span className="font-extrabold text-slate-900">
                            {u.realPagasRenovacoes}
                          </span>{' '}
                          <InlineGoalEditor
                            prefix="/ "
                            value={u.goal.pagasRenovacoes}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'pagasRenovacoes', val)
                            }
                            className="text-slate-700 font-semibold"
                          />
                          <span className="ml-1.5 text-[11px] font-bold text-emerald-700">
                            ({u.pctPagasRenovacoes.toFixed(0)}%)
                          </span>
                        </td>

                        {/* Matrículas Pagas Novatos 2027 */}
                        <td className="py-2.5 px-3 text-right bg-[#D9F2D9]/60 border-r border-slate-300">
                          <span className="font-extrabold text-[#009FE3]">
                            {u.realPagasNovatos}
                          </span>{' '}
                          <InlineGoalEditor
                            prefix="/ "
                            value={u.goal.pagasNovatos2027}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'pagasNovatos2027', val)
                            }
                            className="text-slate-700 font-semibold"
                          />
                          <span className="ml-1.5 text-[11px] font-bold text-sky-700">
                            ({u.pctPagasNovatos.toFixed(0)}%)
                          </span>
                        </td>

                        {/* Novas Vagas Gratuidade 2027 */}
                        <td className="py-2.5 px-3 text-right bg-[#D9F2D9]/60 border-r border-slate-300">
                          <span className="font-extrabold text-slate-900">
                            {u.realNovasGratuidade}
                          </span>{' '}
                          <InlineGoalEditor
                            prefix="/ "
                            value={u.goal.novasVagasGratuidade2027}
                            onCommit={(val) =>
                              onUpdateUnitGoalField(u.goal.id, 'novasVagasGratuidade2027', val)
                            }
                            className="text-slate-700 font-semibold"
                          />
                          <span className="ml-1.5 text-[11px] font-bold text-orange-700">
                            ({u.pctNovasGratuidade.toFixed(0)}%)
                          </span>
                        </td>

                        {/* Meta Geral (Pago + Nova Gratuidade + Gratuidade Remanescente) */}
                        <td className="py-2.5 px-4 text-right bg-[#D9F2D9] border-r border-slate-300">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {u.realTotal}
                            </span>
                            <InlineGoalEditor
                              prefix="/ "
                              value={u.goal.metaGeral}
                              onCommit={(val) =>
                                onUpdateUnitGoalField(u.goal.id, 'metaGeral', val)
                              }
                              className="text-emerald-900 font-bold"
                            />
                            <span className="font-extrabold text-emerald-800">
                              ({u.pctGeral.toFixed(1)}%)
                            </span>
                          </div>
                        </td>

                        {/* Observações editáveis */}
                        <td className="py-2 px-3 font-sans bg-white">
                          <input
                            type="text"
                            value={u.goal.observacoes}
                            onChange={(e) =>
                              onUpdateGoalObs(u.goal.id, e.target.value)
                            }
                            placeholder="Anotar observação da escola..."
                            className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#009FE3]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#00A3E0] text-white font-mono font-extrabold tabular-nums text-sm">
                      <td className="py-3.5 px-4 font-sans border-r border-sky-500">
                        TOTAL REDE SESI-PE
                      </td>
                      <td className="py-3.5 px-3 text-right border-r border-sky-500">
                        {totals.metaGeral.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-3 text-right border-r border-sky-500">
                        {totals.realGratuidadeRemanescente.toLocaleString('pt-BR')} /{' '}
                        {totals.metaGratuidadeRemanescente.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-3 text-right border-r border-sky-500">
                        {totals.realPagasRenovacoes.toLocaleString('pt-BR')} /{' '}
                        {totals.metaPagasRenovacoes.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-3 text-right border-r border-sky-500">
                        {totals.realPagasNovatos.toLocaleString('pt-BR')} /{' '}
                        {totals.metaPagasNovatos2027.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-3 text-right border-r border-sky-500">
                        {totals.realNovasGratuidade.toLocaleString('pt-BR')} /{' '}
                        {totals.metaNovasGratuidade2027.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 text-right border-r border-sky-500">
                        {totals.realTotal.toLocaleString('pt-BR')} /{' '}
                        {totals.metaGeral.toLocaleString('pt-BR')} ({totals.pctGeral.toFixed(1)}%)
                      </td>
                      <td className="py-3.5 px-4 font-sans text-xs font-semibold text-sky-100">
                        {isAutoSyncing
                          ? 'Atualizando via TOTVS RM...'
                          : 'Integrado ao TOTVS RM (Período 2027)'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Modal de Ajuste Completo de Metas de uma Escola */}
      {editingGoalModal && (
        <div
          onClick={() => setEditingGoalModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white border-2 border-b-8 border-sky-300 p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-extrabold text-[#009FE3]">
                  AJUSTAR METAS DA UNIDADE ESCOLAR (2027)
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  Escola SESI {editingGoalModal.shortName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingGoalModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="text-xs font-bold text-sky-900">
                  1. Pagas Novatos 2027
                </span>
                <input
                  type="number"
                  min={0}
                  value={editingGoalModal.pagasNovatos2027}
                  onChange={(e) => {
                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const nextSum =
                      val +
                      editingGoalModal.pagasRenovacoes +
                      editingGoalModal.gratuidadeRemanescente +
                      editingGoalModal.novasVagasGratuidade2027;
                    setEditingGoalModal({
                      ...editingGoalModal,
                      pagasNovatos2027: val,
                      metaGeral: nextSum,
                      metaUnidade2027: nextSum,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-sky-50 border-2 border-sky-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#009FE3]"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-emerald-900">
                  2. Pagas Renovações (Veteranos)
                </span>
                <input
                  type="number"
                  min={0}
                  value={editingGoalModal.pagasRenovacoes}
                  onChange={(e) => {
                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const nextSum =
                      editingGoalModal.pagasNovatos2027 +
                      val +
                      editingGoalModal.gratuidadeRemanescente +
                      editingGoalModal.novasVagasGratuidade2027;
                    setEditingGoalModal({
                      ...editingGoalModal,
                      pagasRenovacoes: val,
                      metaGeral: nextSum,
                      metaUnidade2027: nextSum,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-emerald-50 border-2 border-emerald-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-amber-900">
                  3. Gratuidade Remanescente
                </span>
                <input
                  type="number"
                  min={0}
                  value={editingGoalModal.gratuidadeRemanescente}
                  onChange={(e) => {
                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const nextSum =
                      editingGoalModal.pagasNovatos2027 +
                      editingGoalModal.pagasRenovacoes +
                      val +
                      editingGoalModal.novasVagasGratuidade2027;
                    setEditingGoalModal({
                      ...editingGoalModal,
                      gratuidadeRemanescente: val,
                      metaGeral: nextSum,
                      metaUnidade2027: nextSum,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-amber-50 border-2 border-amber-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-orange-900">
                  4. Novas Vagas Gratuidade 2027
                </span>
                <input
                  type="number"
                  min={0}
                  value={editingGoalModal.novasVagasGratuidade2027}
                  onChange={(e) => {
                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const nextSum =
                      editingGoalModal.pagasNovatos2027 +
                      editingGoalModal.pagasRenovacoes +
                      editingGoalModal.gratuidadeRemanescente +
                      val;
                    setEditingGoalModal({
                      ...editingGoalModal,
                      novasVagasGratuidade2027: val,
                      metaGeral: nextSum,
                      metaUnidade2027: nextSum,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-orange-50 border-2 border-orange-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="space-y-1 block">
                <span className="text-xs font-extrabold text-slate-800">
                  Meta Geral da Escola 2027 (Soma automática ou ajuste direto)
                </span>
                <input
                  type="number"
                  min={0}
                  value={editingGoalModal.metaGeral}
                  onChange={(e) => {
                    const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                    setEditingGoalModal({
                      ...editingGoalModal,
                      metaGeral: val,
                      metaUnidade2027: val,
                    });
                  }}
                  className="w-full px-3 py-2.5 text-base font-mono font-extrabold bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#009FE3]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingGoalModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveUnitGoalFull(editingGoalModal);
                  setEditingGoalModal(null);
                }}
                className="px-5 py-2 text-xs font-extrabold text-white bg-[#009FE3] border-2 border-b-4 border-sky-700 hover:bg-sky-500 rounded-xl transition-colors"
              >
                Salvar Metas da Escola
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visão Detalhada: Produtividade Diária de Matrículas (Matrículas Realizadas por Dia) */}
      {selectedDailyTarget && (
        <div
          onClick={() => setDailyModalUnitId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white border-2 border-b-8 border-indigo-300 p-6 space-y-5 shadow-xl overflow-hidden"
          >
            {/* Cabeçalho do Modal de Produtividade Diária */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-700">
                  <Calendar className="w-4 h-4" />
                  <span>PRODUTIVIDADE DIÁRIA DE MATRÍCULAS (CAMPANHA 08/09 A 31/12)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                  {selectedDailyTarget.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedDailyTarget.id}
                  onChange={(e) => setDailyModalUnitId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-[#009FE3]"
                >
                  <option value="ALL">Rede SESI-PE (Todas as 12 Escolas)</option>
                  {units.map((u) => (
                    <option key={u.goal.id} value={u.goal.id}>
                      Escola SESI {u.goal.shortName} ({u.realTotal}/{u.goal.metaGeral})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setDailyModalUnitId(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Indicadores de Produtividade Diária */}
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50 rounded-2xl p-3 font-mono tabular-nums">
              <div className="px-3 py-1 text-center">
                <div className="text-[10px] font-sans font-bold text-slate-500">
                  Total Matriculados
                </div>
                <div className="text-lg font-extrabold text-[#009FE3]">
                  {selectedDailyTarget.realTotal.toLocaleString('pt-BR')}{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    / {selectedDailyTarget.metaGeral.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="px-3 py-1 text-center">
                <div className="text-[10px] font-sans font-bold text-slate-500">
                  Dias com Matrícula
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {selectedDailyTarget.diasComMatricula}{' '}
                  <span className="text-xs font-sans font-normal text-slate-500">dias</span>
                </div>
              </div>

              <div className="px-3 py-1 text-center">
                <div className="text-[10px] font-sans font-bold text-indigo-700">
                  Média Realizada / Dia
                </div>
                <div className="text-lg font-extrabold text-indigo-700">
                  {selectedDailyTarget.mediaPorDiaAtivo.toFixed(1)}{' '}
                  <span className="text-xs font-sans font-normal text-slate-500">mat./dia</span>
                </div>
              </div>

              <div className="px-3 py-1 text-center">
                <div className="text-[10px] font-sans font-bold text-emerald-700">
                  Melhor Dia (Pico)
                </div>
                <div className="text-lg font-extrabold text-emerald-700">
                  {selectedDailyTarget.picoDia
                    ? `${selectedDailyTarget.picoDia.total} (${selectedDailyTarget.picoDia.shortDate})`
                    : '—'}
                </div>
              </div>

              <div className="px-3 py-1 text-center">
                <div className="text-[10px] font-sans font-bold text-amber-800">
                  Ritmo p/ Meta (até 31/12)
                </div>
                <div className="text-lg font-extrabold text-amber-700">
                  {selectedDailyTarget.metaDiariaAte31Dez.toFixed(1)}{' '}
                  <span className="text-xs font-sans font-normal text-slate-500">mat./dia</span>
                </div>
              </div>
            </div>

            {/* Corpo rolável com Gráfico de Barras Diário + Tabela Dia a Dia */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {selectedDailyTarget.dailyProductivity.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Nenhuma matrícula efetivada (Matriculado ou Pré-Matriculado) encontrada para esta unidade no Período 2027.
                </div>
              ) : (
                <>
                  {/* Gráfico de Evolução de Matrículas por Dia */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Evolução Diária de Matrículas Efetivadas</span>
                      <span className="text-slate-500 font-normal">
                        Passe o mouse sobre as barras para ver o detalhamento por modalidade
                      </span>
                    </div>
                    <div className="h-36 w-full bg-sky-50/70 rounded-2xl p-3 flex items-end gap-1.5 overflow-x-auto">
                      {(() => {
                        const maxDay = Math.max(
                          1,
                          ...selectedDailyTarget.dailyProductivity.map((d) => d.total)
                        );
                        return selectedDailyTarget.dailyProductivity.map((d: DailyEnrollmentEntry) => {
                          const barHeight = Math.max(
                            14,
                            Math.round((d.total / maxDay) * 95)
                          );
                          return (
                            <div
                              key={d.isoDate}
                              title={`${d.displayDate}: ${d.total} matrículas (Novatos Pagos: ${d.pagasNovatos}, Renovações Pagas: ${d.pagasRenovacoes}, Grat. Reman.: ${d.gratuidadeRemanescente}, Novas Grat.: ${d.novasGratuidade})`}
                              className="min-w-[34px] flex-1 flex flex-col items-center justify-end h-full group"
                            >
                              <span className="text-[10px] font-mono font-extrabold text-slate-700 mb-1">
                                {d.total}
                              </span>
                              <div
                                className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-[#009FE3] to-indigo-500 group-hover:from-emerald-500 group-hover:to-teal-400 transition-all"
                                style={{ height: `${barHeight}px` }}
                              />
                              <span className="text-[9px] font-mono font-semibold text-slate-500 mt-1 whitespace-nowrap">
                                {d.shortDate}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Tabela Detalhada de Produtividade por Dia */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-800">
                      Detalhamento de Matrículas Realizadas por Dia ({selectedDailyTarget.dailyProductivity.length} datas com registro)
                    </h4>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-sans font-bold">
                            <th className="py-2.5 px-3">Data da Matrícula</th>
                            <th className="py-2.5 px-3 text-right">Total no Dia</th>
                            <th className="py-2.5 px-3 text-right text-[#009FE3]">Novatos Pagos</th>
                            <th className="py-2.5 px-3 text-right text-emerald-700">Renovações Pagas</th>
                            <th className="py-2.5 px-3 text-right text-amber-700">Grat. Remanesc.</th>
                            <th className="py-2.5 px-3 text-right text-orange-700">Novas Gratuidade</th>
                            <th className="py-2.5 px-3 text-right">Acumulado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            let runningSum = 0;
                            const rowsWithAcc = selectedDailyTarget.dailyProductivity.map((d) => {
                              runningSum += d.total;
                              return {
                                ...d,
                                accumulated: runningSum,
                                accPct:
                                  selectedDailyTarget.metaGeral > 0
                                    ? (runningSum / selectedDailyTarget.metaGeral) * 100
                                    : 0,
                              };
                            });
                            return [...rowsWithAcc].reverse().map((d) => (
                              <tr key={d.isoDate} className="hover:bg-sky-50/50">
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {d.displayDate}
                                </td>
                                <td className="py-2 px-3 text-right font-extrabold text-indigo-700 bg-indigo-50/40">
                                  +{d.total}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {d.pagasNovatos}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {d.pagasRenovacoes}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {d.gratuidadeRemanescente}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {d.novasGratuidade}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-800">
                                  {d.accumulated.toLocaleString('pt-BR')}{' '}
                                  <span className="text-[10px] text-emerald-700">
                                    ({d.accPct.toFixed(1)}%)
                                  </span>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rodapé do Modal de Produtividade */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Baseado na coluna <code className="font-mono font-bold text-slate-700">DT MATRICULA</code> dos alunos com situação Matriculado ou Pré-Matriculado.
              </span>
              <div className="flex items-center gap-2">
                {selectedDailyTarget.totvsUnitName && (
                  <button
                    type="button"
                    onClick={() => {
                      const unitName = selectedDailyTarget.totvsUnitName;
                      setDailyModalUnitId(null);
                      onInspectUnitInGrid(unitName);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-[#009FE3] bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
                  >
                    Ver Alunos desta Escola na Lista SQL
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDailyModalUnitId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alunos por Status: Renovação via Portal / Inscrição Online */}
      {statusModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setStatusModalTarget(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-white border-2 border-b-8 border-sky-400 p-6 shadow-2xl space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider ${
                    statusModalTarget.statusType === 'RENOVACAO_PORTAL'
                      ? 'text-violet-700'
                      : 'text-teal-700'
                  }`}
                >
                  {statusModalTarget.statusType === 'RENOVACAO_PORTAL'
                    ? 'Alunos em Renovação via Portal'
                    : 'Alunos em Inscrição Online / Reserva'}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {statusModalTarget.unitName} ·{' '}
                  <span className="font-mono text-[#009FE3]">
                    {filteredStatusStudents.length} aluno(s)
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {filteredStatusStudents.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center text-sm text-slate-500">
                  Nenhum aluno encontrado com status{' '}
                  <strong>
                    {statusModalTarget.statusType === 'RENOVACAO_PORTAL'
                      ? 'Renovação via Portal'
                      : 'Inscrição Online'}
                  </strong>{' '}
                  nesta escola.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                        <th className="py-2.5 px-3">RA</th>
                        <th className="py-2.5 px-3">Nome do Aluno</th>
                        <th className="py-2.5 px-3">Série / Turma</th>
                        <th className="py-2.5 px-3">Tipo / Ingresso</th>
                        <th className="py-2.5 px-3">Situação Matrícula</th>
                        <th className="py-2.5 px-3">Serviço / Modalidade</th>
                        <th className="py-2.5 px-3">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredStatusStudents.map((st, idx) => (
                        <tr key={`${st.RA}-${idx}`} className="hover:bg-sky-50/60">
                          <td className="py-2 px-3 font-bold text-slate-700">
                            {String(st['RA'] ?? '-')}
                          </td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-900">
                            {String(st['ALUNO'] ?? '-')}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-700">
                            {String(st['SERIE/ANO'] ?? '-')} · {String(st['TURNO'] ?? '-')}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600">
                            {String(st['TIPO MATRICULA'] ?? '-')}
                            {st['FORMAINGRESSO'] ? ` (${String(st['FORMAINGRESSO'])})` : ''}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                statusModalTarget.statusType === 'RENOVACAO_PORTAL'
                                  ? 'bg-violet-100 text-violet-900'
                                  : 'bg-teal-100 text-teal-900'
                              }`}
                            >
                              {String(st['SITUACAO MATRICULA'] ?? '-')}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-[200px]">
                            {String(st['SERVICO'] ?? '-')}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Estes alunos ainda aguardam efetivação para contabilizar na meta oficial de matriculados.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const { totvsUnitName, statusType } = statusModalTarget;
                    setStatusModalTarget(null);
                    onInspectUnitInGrid(totvsUnitName, statusType);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-[#009FE3] bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors cursor-pointer"
                >
                  Filtrar na Lista SQL Completa
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setStatusModalTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ocupação da Turma por Unidade (Comparando Matriculados vs Coluna MAX ALUNOS do SQL) */}
      {turmaModalUnitId && (() => {
        const selectedUnit = units.find((u) => u.goal.id === turmaModalUnitId) || units[0];
        if (!selectedUnit) return null;

        const allUnitTurmas = selectedUnit.turmas;
        const turmasWithOcupacao = allUnitTurmas.filter((t) => t.ocupacaoComReservada > 0);
        const turmasList =
          onlyWithMatriculados && turmasWithOcupacao.length > 0
            ? turmasWithOcupacao
            : allUnitTurmas;

        const getEffectiveCap = (t: TurmaOccupancyEntry) =>
          turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0;

        const totalMatriculadosUnit = turmasList.reduce((acc, t) => acc + t.matriculadosTotal, 0);
        const totalReservadaUnit = turmasList.reduce((acc, t) => acc + t.matriculaReservada, 0);
        const totalOcupacaoSalaUnit = turmasList.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
        const totalComPendentesUnit = turmasList.reduce((acc, t) => acc + t.totalAtivosComPendentes, 0);
        const totalMaxAlunosUnit = turmasList.reduce(
          (acc, t) => acc + getEffectiveCap(t),
          0
        );
        const activeCountForPct =
          turmaCountMode === 'ocupacao_sala'
            ? totalOcupacaoSalaUnit
            : turmaCountMode === 'matriculados'
            ? totalMatriculadosUnit
            : totalComPendentesUnit;
        const pctOcupacaoGeral =
          totalMaxAlunosUnit > 0
            ? (activeCountForPct / totalMaxAlunosUnit) * 100
            : 0;
        const saldoVagasGeral =
          totalMaxAlunosUnit > 0
            ? totalMaxAlunosUnit - activeCountForPct
            : 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => setTurmaModalUnitId(null)}
          >
            <div
              className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-3.5 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho do Modal de Ocupação de Turmas */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-extrabold text-[#009FE3] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Mapa de Ocupação de Sala (Matriculados + Matrícula Reservada vs MAX ALUNOS)
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Escola SESI {selectedUnit.goal.shortName} ·{' '}
                    <span className="font-mono text-[#009FE3]">
                      {turmasList.length} turma(s) identificada(s)
                    </span>
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedUnit.goal.id;
                      setTurmaModalUnitId(null);
                      setEmailModalState({
                        open: true,
                        tab: 'unit',
                        unitId: targetId,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                    title="Cadastrar e-mail desta unidade, adicionar cópias (CC) e agendar/disparar relatório com ocupação de turmas e alunos em Renovação via Portal"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    E-mail & Relatório Periódico desta Unidade
                  </button>

                  <label className="text-xs font-bold text-slate-600">Unidade:</label>
                  <select
                    value={selectedUnit.goal.id}
                    onChange={(e) => setTurmaModalUnitId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-sky-50 border border-sky-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                  >
                    {units.map((u) => (
                      <option key={u.goal.id} value={u.goal.id}>
                        Escola SESI {u.goal.shortName} ({u.turmas.length} turmas)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setTurmaModalUnitId(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Faixa de Resumo de Ocupação de Sala */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-sky-50/70 p-3 rounded-2xl border border-sky-100">
                <div className="px-2">
                  <div className="text-[10px] font-bold text-slate-500">Total de Turmas</div>
                  <div className="text-lg font-extrabold font-mono text-slate-900">
                    {turmasList.length}
                  </div>
                </div>
                <div className="px-2 border-l border-sky-200/70">
                  <div className="text-[10px] font-bold text-emerald-800">
                    Matriculados + Pré
                  </div>
                  <div className="text-lg font-extrabold font-mono text-emerald-700">
                    {totalMatriculadosUnit.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[9px] text-emerald-700 font-semibold">
                    Conta na meta
                  </div>
                </div>
                <div className="px-2 border-l border-sky-200/70">
                  <div className="text-[10px] font-bold text-amber-900">
                    Matrícula Reservada
                  </div>
                  <div className="text-lg font-extrabold font-mono text-amber-700">
                    {totalReservadaUnit.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[9px] text-amber-800 font-semibold">
                    Vaga veterano até 31/12
                  </div>
                </div>
                <div className="px-2 border-l border-sky-200/70 bg-white/70 rounded-xl py-0.5">
                  <div className="text-[10px] font-extrabold text-sky-950">
                    Ocupação da Sala
                  </div>
                  <div className="text-lg font-extrabold font-mono text-sky-900">
                    {totalOcupacaoSalaUnit.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[9px] text-slate-600 font-semibold">
                    Matr. + Reservada
                  </div>
                </div>
                <div className="px-2 border-l border-sky-200/70">
                  <div className="text-[10px] font-bold text-sky-900">
                    Máx. Alunos (SQL)
                  </div>
                  <div className="text-lg font-extrabold font-mono text-[#009FE3]">
                    {totalMaxAlunosUnit > 0
                      ? totalMaxAlunosUnit.toLocaleString('pt-BR')
                      : 'Sincronize SQL'}
                  </div>
                </div>
                <div className="px-2 border-l border-sky-200/70">
                  <div className="text-[10px] font-bold text-amber-800">
                    % Ocupação / Saldo
                  </div>
                  <div className="text-base font-extrabold font-mono text-amber-600">
                    {totalMaxAlunosUnit > 0
                      ? `${pctOcupacaoGeral.toFixed(1)}% (${saldoVagasGeral >= 0 ? `${saldoVagasGeral} livres` : `+${Math.abs(saldoVagasGeral)} exc.`})`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Aviso da Regra Legal de Reserva de Vaga dos Veteranos */}
              <div className="px-3.5 py-2 rounded-xl bg-amber-50/90 border border-amber-200 text-[11px] text-amber-950 flex items-center justify-between gap-2">
                <span>
                  <strong>Regra de Ocupação de Sala (Veteranos):</strong> Os alunos com status{' '}
                  <strong>Matrícula Reservada ({totalReservadaUnit})</strong> possuem vaga garantida por lei até o último dia do ano vigente e{' '}
                  <strong>compõem a ocupação da turma</strong>, mas <strong>não contam como matriculados</strong> (perdem a vaga caso não renovem até o 1º dia do ano).
                </span>
              </div>

              {/* Barra de Controles da Ocupação (Filtro de Turmas & Modo de Contagem) */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">Exibir:</span>
                    <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setOnlyWithMatriculados(true)}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          onlyWithMatriculados
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Turmas c/ Ocupação ({turmasWithOcupacao.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlyWithMatriculados(false)}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          !onlyWithMatriculados
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todas as Turmas ({allUnitTurmas.length})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">Calcular ocupação sobre:</span>
                    <div className="inline-flex p-0.5 bg-white border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTurmaCountMode('ocupacao_sala')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          turmaCountMode === 'ocupacao_sala'
                            ? 'bg-[#009FE3] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Matriculados + Reservada ({totalOcupacaoSalaUnit})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTurmaCountMode('matriculados')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          turmaCountMode === 'matriculados'
                            ? 'bg-[#009FE3] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Só Matriculados + Pré ({totalMatriculadosUnit})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTurmaCountMode('todos')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          turmaCountMode === 'todos'
                            ? 'bg-[#009FE3] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todos c/ Portal ({totalComPendentesUnit})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 font-semibold">
                    Preencher capacidade padrão para todas as turmas desta escola:
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Ex: 35"
                    value={bulkCapacityDraft}
                    onChange={(e) => setBulkCapacityDraft(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#009FE3]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Number(bulkCapacityDraft);
                      if (!Number.isNaN(val) && val >= 0) {
                        handleApplyBulkCapacityToUnit(turmasList, val);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-[#009FE3] hover:bg-sky-600 rounded-lg transition-colors cursor-pointer"
                  >
                    Aplicar em Todas
                  </button>
                </div>
              </div>

              {/* Tabela de Turmas da Unidade */}
              <div className="overflow-y-auto flex-1 pr-1">
                {turmasList.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center text-sm text-slate-500">
                    Nenhuma turma encontrada para esta unidade no período 2027.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                          <th className="py-2.5 px-3">Código da Turma</th>
                          <th className="py-2.5 px-3">Série / Habilitação / Curso</th>
                          <th className="py-2.5 px-3">Turno</th>
                          <th className="py-2.5 px-3 text-right text-emerald-800">
                            Matriculados + Pré
                          </th>
                          <th className="py-2.5 px-3 text-right text-amber-900 bg-amber-50/60">
                            Matr. Reservada (Vet.)
                          </th>
                          <th className="py-2.5 px-3 text-right text-sky-950 bg-sky-100/60">
                            Ocupação da Sala
                          </th>
                          <th className="py-2.5 px-3 text-right text-violet-800">
                            Portal / Inscr.
                          </th>
                          <th className="py-2.5 px-3 text-center bg-sky-50/80 text-sky-950">
                            MAX ALUNOS (SQL)
                          </th>
                          <th className="py-2.5 px-3 text-right">Vagas Restantes</th>
                          <th className="py-2.5 px-3 w-44">Ocupação da Turma</th>
                          <th className="py-2.5 px-3 text-right">Alunos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {turmasList.map((t) => {
                          const cap = getEffectiveCap(t);
                          const isManualOverride = Boolean(turmaCapacities[t.turmaKey]);
                          const consideredCount =
                            turmaCountMode === 'ocupacao_sala'
                              ? t.ocupacaoComReservada
                              : turmaCountMode === 'matriculados'
                              ? t.matriculadosTotal
                              : t.totalAtivosComPendentes;
                          const pct = cap > 0 ? (consideredCount / cap) * 100 : 0;
                          const vagasRestantes = cap > 0 ? cap - consideredCount : null;
                          const pendentesPortalInscr = t.renovacaoPortal + t.reservadaInscricao;

                          return (
                            <tr key={t.turmaKey} className="hover:bg-sky-50/50">
                              <td className="py-2 px-3 font-extrabold text-slate-900">
                                {t.turmaCode}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-700 max-w-[240px] truncate" title={t.habilitacao || t.curso}>
                                {t.habilitacao || t.curso || '—'}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600">
                                {t.turno || '—'}
                              </td>
                              <td className="py-2 px-3 text-right bg-emerald-50/40">
                                <span className="font-extrabold text-emerald-700 text-sm">
                                  {t.matriculadosTotal}
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  V:{t.matriculadosVeteranos} · N:{t.matriculadosNovatos}
                                </span>
                              </td>
                              <td
                                className="py-2 px-3 text-right bg-amber-50/40"
                                title="Veteranos com Matrícula Reservada: garantem vaga na sala até 31/12, mas não contam como matriculados"
                              >
                                <span className="font-extrabold text-amber-800 text-sm">
                                  {t.matriculaReservada}
                                </span>
                                <span className="block text-[9px] font-sans text-amber-700">
                                  vaga garantida
                                </span>
                              </td>
                              <td
                                className="py-2 px-3 text-right bg-sky-50/70"
                                title={`Ocupação da Sala = ${t.matriculadosTotal} Matriculados + ${t.matriculaReservada} Matrículas Reservadas`}
                              >
                                <span className="font-extrabold text-sky-950 text-sm">
                                  {t.ocupacaoComReservada}
                                </span>
                                <span className="block text-[9px] font-sans text-sky-800">
                                  Matr. + Reserv.
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-violet-700">
                                {pendentesPortalInscr > 0 ? (
                                  <span title={`Portal: ${t.renovacaoPortal} | Inscrição Online: ${t.reservadaInscricao}`}>
                                    +{pendentesPortalInscr}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </td>
                              <td className="py-2 px-3 text-center bg-sky-50/40">
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder={t.maxAlunosSql > 0 ? String(t.maxAlunosSql) : 'SQL...'}
                                    value={cap > 0 ? cap : ''}
                                    onChange={(e) =>
                                      handleUpdateTurmaCapacity(t.turmaKey, e.target.value)
                                    }
                                    title={
                                      t.maxAlunosSql > 0
                                        ? `Valor vindo da coluna MAX ALUNOS do SQL: ${t.maxAlunosSql}${isManualOverride ? ' (ajustado manualmente)' : ''}`
                                        : 'Coluna MAX ALUNOS do SQL (ou digite manualmente)'
                                    }
                                    className={`w-20 px-2 py-1 text-center text-xs font-mono font-extrabold text-slate-900 bg-white border-2 rounded-lg focus:outline-none focus:border-[#009FE3] ${
                                      t.maxAlunosSql > 0 && !isManualOverride
                                        ? 'border-sky-300'
                                        : 'border-amber-300'
                                    }`}
                                  />
                                  {t.maxAlunosSql > 0 && !isManualOverride && (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-[#009FE3] text-[9px] font-sans font-extrabold">
                                      SQL
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-bold">
                                {vagasRestantes === null ? (
                                  <span className="text-slate-400">—</span>
                                ) : vagasRestantes >= 0 ? (
                                  <span className="text-emerald-700">{vagasRestantes} vagas</span>
                                ) : (
                                  <span className="text-rose-600">
                                    +{Math.abs(vagasRestantes)} acima
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {cap > 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                      <span
                                        className={
                                          pct > 100
                                            ? 'text-rose-600'
                                            : pct >= 85
                                            ? 'text-emerald-700'
                                            : 'text-[#009FE3]'
                                        }
                                      >
                                        {pct.toFixed(1)}%
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {consideredCount}/{cap}
                                      </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          pct > 100
                                            ? 'bg-rose-500'
                                            : pct >= 85
                                            ? 'bg-emerald-500'
                                            : 'bg-[#009FE3]'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-sans text-slate-400">
                                    Informe a capacidade
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const unitName = selectedUnit.goal.totvsUnitName;
                                    const turmaCode = t.turmaCode;
                                    setTurmaModalUnitId(null);
                                    onInspectUnitInGrid(unitName, turmaCode);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#009FE3] hover:text-sky-700 cursor-pointer"
                                  title="Filtrar alunos desta turma na Lista SQL"
                                >
                                  Ver
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Rodapé do Modal de Ocupação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  As capacidades digitadas ficam salvas automaticamente para cada turma e unidade.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedUnit.goal.id;
                      setTurmaModalUnitId(null);
                      setEmailModalState({
                        open: true,
                        tab: 'unit',
                        unitId: targetId,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Visualizar / Salvar Relatório de SESI {selectedUnit.goal.shortName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurmaModalUnitId(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Compartilhamento do Modo TV Escolar (Sem Dados Sensíveis / Sem Login) */}
      {shareTvModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4"
          onClick={() => setShareTvModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white border-2 border-b-8 border-emerald-500 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  Modo TV Escolar · 100% Sem Dados Sensíveis
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Compartilhar Painel Modo TV (Sem Bloqueio de Permissão)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareTvModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950 space-y-1.5">
              <div className="font-extrabold flex items-center gap-1.5 text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                {loadingPublicTvUrl
                  ? 'Gerando Link Público Direto do Modo TV...'
                  : 'Link Público Direto Copiado Automaticamente!'}
              </div>
              <p className="text-emerald-900 leading-relaxed">
                Este link público abre direto no <strong>Modo TV Escolar (One-Page)</strong> em
                qualquer navegador, Smart TV ou celular, <strong>sem pedir login/permissão</strong> e
                exibindo apenas os indicadores agregados das 12 escolas (sem dados sensíveis).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
                1. Link Público Direto do Modo TV (Sem Senha / Sem Erro de Permissão):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    loadingPublicTvUrl
                      ? 'Gerando link público seguro...'
                      : publicTvUrl || getPublicTvShareUrl()
                  }
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-300 rounded-xl focus:outline-none"
                />
                <button
                  type="button"
                  disabled={loadingPublicTvUrl}
                  onClick={() => {
                    const targetUrl = publicTvUrl || getPublicTvShareUrl();
                    navigator.clipboard.writeText(targetUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 3000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedLink ? 'Copiado!' : 'Copiar Link'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-2.5">
              <div className="text-xs font-extrabold text-amber-950">
                2. Enviar Link por WhatsApp ou Baixar Arquivo Modo TV Portátil (.HTML):
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Você pode enviar o link público acima direto pelo WhatsApp ou também baixar o{' '}
                <strong>Painel Modo TV Portátil (.HTML)</strong> para abrir offline/via pendrive em
                qualquer Smart TV:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadStandaloneTvHtml({
                      units,
                      totals,
                      turmaCapacities,
                    })
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Baixar Painel Modo TV Portátil (.HTML)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = publicTvUrl || getPublicTvShareUrl();
                    const msg = encodeURIComponent(
                      `📺 *Mural Modo TV Escolar — Matrículas SESI-PE 2027*\nPlacar geral: *${totals.realTotal.toLocaleString('pt-BR')} / ${totals.metaPagasTotal.toLocaleString('pt-BR')}* (${totals.pctPagasTotal.toFixed(1)}%)\n\n🔗 Acesse o Modo TV ao vivo (sem login):\n${shareUrl}`
                    );
                    const a = document.createElement('a');
                    a.href = `https://api.whatsapp.com/send?text=${msg}`;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar no WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal da Central de E-mails e Relatórios Periódicos (Unidades & Rede) */}
      <EmailReportsCenterModal
        isOpen={emailModalState.open}
        initialTab={emailModalState.tab}
        initialUnitId={emailModalState.unitId}
        onClose={() => setEmailModalState((prev) => ({ ...prev, open: false }))}
        units={units}
        totals={totals}
        rows={rows}
        turmaCapacities={turmaCapacities}
      />
    </div>
  );
};
