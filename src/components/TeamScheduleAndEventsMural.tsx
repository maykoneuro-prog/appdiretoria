import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  MapPin,
  Camera,
  Plus,
  Trash2,
  Pencil,
  Users,
  Clock,
  Building2,
  School,
  Home,
  Plane,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Play,
  Pause,
  KeyRound,
  Image as ImageIcon,
  PartyPopper,
  ShieldCheck,
} from 'lucide-react';
import { BirthdayMember,TvCarouselSettings } from './TeamBirthdaysMural';

export type LocationCategory =
  | 'sede'
  | 'escola'
  | 'evento'
  | 'home_office'
  | 'viagem'
  | 'ferias';

export interface TeamScheduleEntry {
  id: string;
  memberId: string;
  memberName: string;
  day: number;
  endDay: number;
  month: number;
  shift: string;
  locationCategory: LocationCategory;
  locationName: string;
  activity: string;
}

export interface TeamMonthlyEvent {
  id: string;
  title: string;
  day: number;
  endDay: number;
  month: number;
  timeRange: string;
  location: string;
  status: 'upcoming' | 'today' | 'past';
  description: string;
  coverPhotoDataUrl?: string;
  extraPhotoDataUrl1?: string;
  extraPhotoDataUrl2?: string;
}

export const TEAM_SCHEDULES_STORAGE_KEY = 'sesi_pe_team_schedules_2027_v1';
export const TEAM_EVENTS_STORAGE_KEY = 'sesi_pe_team_events_2027_v1';
export const TEAM_COLLAB_EMAILS_STORAGE_KEY = 'sesi_pe_team_collab_emails_2027_v1';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const LOCATION_CATEGORY_META: Record<
  LocationCategory,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  sede: {
    label: 'Sede Educação / GEDUC',
    shortLabel: 'Sede / GEDUC',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    border: 'border-sky-300',
  },
  escola: {
    label: 'Em Unidade Escolar SESI',
    shortLabel: 'Unidade Escolar',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    border: 'border-emerald-300',
  },
  evento: {
    label: 'Em Evento / Ação Externa',
    shortLabel: 'Em Evento',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    border: 'border-amber-300',
  },
  home_office: {
    label: 'Home Office / Remoto',
    shortLabel: 'Home Office',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
    border: 'border-indigo-300',
  },
  viagem: {
    label: 'Missão / Viagem Técnica',
    shortLabel: 'Missão / Viagem',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    border: 'border-purple-300',
  },
  ferias: {
    label: 'Férias / Folga / Ausente',
    shortLabel: 'Férias / Folga',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    border: 'border-rose-300',
  },
};

const QUICK_LOCATIONS = [
  'Sede Educação (GEDUC - Recife)',
  'Escola SESI Ibura',
  'Escola SESI Vasco da Gama',
  'Escola SESI Paulista',
  'Escola SESI Cabo',
  'Escola SESI Escada',
  'Escola SESI Moreno',
  'Escola SESI Camaragibe',
  'Escola SESI Goiana',
  'Escola SESI Belo Jardim',
  'Escola SESI Caruaru',
  'Escola SESI Araripina',
  'Escola SESI Petrolina',
  'Home Office (Remoto)',
  'Auditório Casa da Indústria (FIEPE)',
];

async function compressEventPhotoToDataUrl(file: File, maxWidth = 820): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface TeamScheduleAndEventsMuralProps {
  members: BirthdayMember[];
  schedules: TeamScheduleEntry[];
  onChangeSchedules: (next: TeamScheduleEntry[]) => void;
  events: TeamMonthlyEvent[];
  onChangeEvents: (next: TeamMonthlyEvent[]) => void;
  collaboratorEmails: Record<string, string>;
  onChangeCollaboratorEmails: (next: Record<string, string>) => void;
  onPreApproveCollaboratorEmail?: (email: string, displayName: string) => Promise<void>;
  carouselSettings: TvCarouselSettings;
  onChangeCarouselSettings: (next: TvCarouselSettings) => void;
  isTvMode: boolean;
  isAdmin?: boolean;
  onSwitchToEnrollments: () => void;
  onSwitchToBirthdays: () => void;
}

export const TeamScheduleAndEventsMural: React.FC<TeamScheduleAndEventsMuralProps> = ({
  members,
  schedules,
  onChangeSchedules,
  events,
  onChangeEvents,
  collaboratorEmails,
  onChangeCollaboratorEmails,
  onPreApproveCollaboratorEmail,
  carouselSettings,
  onChangeCarouselSettings,
  isTvMode,
  onSwitchToEnrollments,
  onSwitchToBirthdays,
}) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(currentMonth);
  const [categoryFilter, setCategoryFilter] = useState<LocationCategory | 'ALL'>('ALL');
  const [activeSubView, setActiveSubView] = useState<'ambos' | 'agendas' | 'eventos'>('ambos');

  // Carrossel interno de Destaques (Eventos Passados com Fotos + Agenda da Equipe)
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Modal de Cadastro/Edição de Agenda do Colaborador
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [schedMemberId, setSchedMemberId] = useState<string>('');
  const [schedDay, setSchedDay] = useState<number>(currentDay);
  const [schedEndDay, setSchedEndDay] = useState<number>(currentDay);
  const [schedMonth, setSchedMonth] = useState<number>(currentMonth);
  const [schedShift, setSchedShift] = useState<string>('Dia Todo (08h às 17h)');
  const [schedCategory, setSchedCategory] = useState<LocationCategory>('sede');
  const [schedLocationName, setSchedLocationName] = useState<string>(
    'Sede Educação (GEDUC - Recife)'
  );
  const [schedActivity, setSchedActivity] = useState<string>('');

  // Modal de Cadastro/Edição de Evento do Mês + Fotos de Evento Passado
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDay, setEvtDay] = useState<number>(currentDay);
  const [evtEndDay, setEvtEndDay] = useState<number>(currentDay);
  const [evtMonth, setEvtMonth] = useState<number>(currentMonth);
  const [evtTimeRange, setEvtTimeRange] = useState('08h30 às 17h00');
  const [evtLocation, setEvtLocation] = useState('Rede SESI-PE / Auditório GEDUC');
  const [evtStatus, setEvtStatus] = useState<'upcoming' | 'today' | 'past'>('upcoming');
  const [evtDescription, setEvtDescription] = useState('');
  const [evtPhoto1, setEvtPhoto1] = useState<string>('');
  const [evtPhoto2, setEvtPhoto2] = useState<string>('');
  const [evtPhoto3, setEvtPhoto3] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Modal de Liberar Acesso para os Colaboradores Cadastrarem Suas Agendas
  const [accessTeamModalOpen, setAccessTeamModalOpen] = useState(false);
  const [savedAccessBanner, setSavedAccessBanner] = useState<string | null>(null);

  // Upload rápido de foto para um evento já existente
  const quickEventPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [quickEventTargetId, setQuickEventTargetId] = useState<string | null>(null);

  // Filtra agendas do mês selecionado
  const monthSchedules = useMemo(() => {
    return schedules
      .filter((s) => (selectedMonth === 'ALL' ? true : s.month === selectedMonth))
      .sort((a, b) => a.month - b.month || a.day - b.day);
  }, [schedules, selectedMonth]);

  // Filtra eventos do mês selecionado
  const monthEvents = useMemo(() => {
    const filtered = events.filter((e) =>
      selectedMonth === 'ALL' ? true : e.month === selectedMonth
    );
    const list = filtered.length > 0 ? filtered : events;
    return [...list].sort((a, b) => a.month - b.month || a.day - b.day);
  }, [events, selectedMonth]);

  // Monta os slides da vitrine em carrossel (Fotos de Eventos Passados + Eventos do Mês + Destaques da Equipe)
  const carouselSlides = useMemo(() => {
    const slides: Array<
      | {
          type: 'event_photo';
          event: TeamMonthlyEvent;
          photoUrl: string;
          photoIndex: number;
          totalPhotos: number;
        }
      | {
          type: 'event_card';
          event: TeamMonthlyEvent;
        }
    > = [];

    for (const ev of monthEvents) {
      const photos = [
        ev.coverPhotoDataUrl,
        ev.extraPhotoDataUrl1,
        ev.extraPhotoDataUrl2,
      ].filter(Boolean) as string[];

      if (photos.length > 0) {
        photos.forEach((p, idx) => {
          slides.push({
            type: 'event_photo',
            event: ev,
            photoUrl: p,
            photoIndex: idx + 1,
            totalPhotos: photos.length,
          });
        });
      } else {
        slides.push({
          type: 'event_card',
          event: ev,
        });
      }
    }
    return slides;
  }, [monthEvents]);

  useEffect(() => {
    if (carouselSlides.length <= 1) {
      setSpotlightIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % carouselSlides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  const currentSlide =
    carouselSlides.length > 0 ? carouselSlides[spotlightIndex % carouselSlides.length] : null;

  // Mapeia cada colaborador cadastrado no Aniversário do Mês com sua agenda mensal e onde está hoje
  const collaboratorsWithSchedule = useMemo(() => {
    return members
      .map((member) => {
        const memberScheds = monthSchedules.filter((s) => s.memberId === member.id);
        // Descobre o compromisso de hoje (ou o mais próximo/recente)
        const todayEntry =
          memberScheds.find(
            (s) =>
              s.month === currentMonth && currentDay >= s.day && currentDay <= (s.endDay || s.day)
          ) ||
          memberScheds[0] ||
          null;

        const effectiveCategory: LocationCategory = todayEntry?.locationCategory || 'sede';
        const effectiveLocation =
          todayEntry?.locationName || member.unitOrSector || 'Sede Educação / GEDUC';

        return {
          member,
          schedules: memberScheds,
          todayEntry,
          effectiveCategory,
          effectiveLocation,
        };
      })
      .filter((item) =>
        categoryFilter === 'ALL' ? true : item.effectiveCategory === categoryFilter
      );
  }, [members, monthSchedules, currentMonth, currentDay, categoryFilter]);

  // Métricas rápidas de localização da equipe
  const teamStats = useMemo(() => {
    let sede = 0;
    let escola = 0;
    let evento = 0;
    let outros = 0;
    for (const m of members) {
      const mScheds = monthSchedules.filter((s) => s.memberId === m.id);
      const active =
        mScheds.find(
          (s) =>
            s.month === currentMonth && currentDay >= s.day && currentDay <= (s.endDay || s.day)
        ) || mScheds[0];
      const cat = active?.locationCategory || 'sede';
      if (cat === 'sede') sede++;
      else if (cat === 'escola') escola++;
      else if (cat === 'evento') evento++;
      else outros++;
    }
    return { total: members.length, sede, escola, evento, outros };
  }, [members, monthSchedules, currentMonth, currentDay]);

  const openNewScheduleModal = (preselectedMemberId?: string) => {
    setEditingScheduleId(null);
    const targetMember =
      members.find((m) => m.id === preselectedMemberId) || members[0] || null;
    setSchedMemberId(targetMember?.id || '');
    setSchedDay(currentDay);
    setSchedEndDay(currentDay);
    setSchedMonth(selectedMonth === 'ALL' ? currentMonth : selectedMonth);
    setSchedShift('Dia Todo (08h às 17h)');
    setSchedCategory('escola');
    setSchedLocationName('Escola SESI Paulista');
    setSchedActivity('Acompanhamento da Campanha de Matrículas 2027 / Suporte Escolar');
    setScheduleModalOpen(true);
  };

  const openEditScheduleModal = (entry: TeamScheduleEntry) => {
    setEditingScheduleId(entry.id);
    setSchedMemberId(entry.memberId);
    setSchedDay(entry.day);
    setSchedEndDay(entry.endDay || entry.day);
    setSchedMonth(entry.month);
    setSchedShift(entry.shift);
    setSchedCategory(entry.locationCategory);
    setSchedLocationName(entry.locationName);
    setSchedActivity(entry.activity);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const foundMember = members.find((m) => m.id === schedMemberId);
    const memberName = foundMember?.name || 'Colaborador SESI';
    const safeDay = Math.max(1, Math.min(31, Number(schedDay) || 1));
    const safeEndDay = Math.max(safeDay, Math.min(31, Number(schedEndDay) || safeDay));
    const safeMonth = Math.max(1, Math.min(12, Number(schedMonth) || currentMonth));

    if (editingScheduleId) {
      const next = schedules.map((s) =>
        s.id === editingScheduleId
          ? {
              ...s,
              memberId: schedMemberId || s.memberId,
              memberName,
              day: safeDay,
              endDay: safeEndDay,
              month: safeMonth,
              shift: schedShift.trim() || 'Dia Todo',
              locationCategory: schedCategory,
              locationName: schedLocationName.trim() || 'Sede Educação',
              activity: schedActivity.trim(),
            }
          : s
      );
      onChangeSchedules(next);
    } else {
      const newEntry: TeamScheduleEntry = {
        id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        memberId: schedMemberId || members[0]?.id || 'collab-1',
        memberName,
        day: safeDay,
        endDay: safeEndDay,
        month: safeMonth,
        shift: schedShift.trim() || 'Dia Todo',
        locationCategory: schedCategory,
        locationName: schedLocationName.trim() || 'Sede Educação',
        activity: schedActivity.trim(),
      };
      onChangeSchedules([...schedules, newEntry]);
    }
    setScheduleModalOpen(false);
  };

  const handleDeleteSchedule = (id: string) => {
    onChangeSchedules(schedules.filter((s) => s.id !== id));
  };

  const openNewEventModal = (defaultPastWithPhotos = false) => {
    setEditingEventId(null);
    setEvtTitle('');
    setEvtDay(currentDay);
    setEvtEndDay(currentDay);
    setEvtMonth(selectedMonth === 'ALL' ? currentMonth : selectedMonth);
    setEvtTimeRange('08h30 às 17h00');
    setEvtLocation('Rede SESI-PE / Unidades Escolares');
    setEvtStatus(defaultPastWithPhotos ? 'past' : 'upcoming');
    setEvtDescription('');
    setEvtPhoto1('');
    setEvtPhoto2('');
    setEvtPhoto3('');
    setEventModalOpen(true);
  };

  const openEditEventModal = (ev: TeamMonthlyEvent) => {
    setEditingEventId(ev.id);
    setEvtTitle(ev.title);
    setEvtDay(ev.day);
    setEvtEndDay(ev.endDay || ev.day);
    setEvtMonth(ev.month);
    setEvtTimeRange(ev.timeRange);
    setEvtLocation(ev.location);
    setEvtStatus(ev.status);
    setEvtDescription(ev.description);
    setEvtPhoto1(ev.coverPhotoDataUrl || '');
    setEvtPhoto2(ev.extraPhotoDataUrl1 || '');
    setEvtPhoto3(ev.extraPhotoDataUrl2 || '');
    setEventModalOpen(true);
  };

  const handleEventFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const results: string[] = [];
      for (const file of files.slice(0, 3)) {
        const compressed = await compressEventPhotoToDataUrl(file, 820);
        results.push(compressed);
      }
      if (results[0] && !evtPhoto1) {
        setEvtPhoto1(results[0]);
        if (results[1] && !evtPhoto2) setEvtPhoto2(results[1]);
        if (results[2] && !evtPhoto3) setEvtPhoto3(results[2]);
      } else if (results[0] && !evtPhoto2) {
        setEvtPhoto2(results[0]);
        if (results[1] && !evtPhoto3) setEvtPhoto3(results[1]);
      } else if (results[0] && !evtPhoto3) {
        setEvtPhoto3(results[0]);
      } else if (results[0]) {
        setEvtPhoto1(results[0]);
      }
      // Se subiu fotos de evento, sugere status 'past' (Evento Realizado) caso ainda esteja 'upcoming'
      setEvtStatus('past');
    } catch {
      // ignore
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleQuickEventPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickEventTargetId) return;
    try {
      const dataUrl = await compressEventPhotoToDataUrl(file, 820);
      const next = events.map((ev) => {
        if (ev.id !== quickEventTargetId) return ev;
        if (!ev.coverPhotoDataUrl) {
          return { ...ev, coverPhotoDataUrl: dataUrl, status: 'past' as const };
        }
        if (!ev.extraPhotoDataUrl1) {
          return { ...ev, extraPhotoDataUrl1: dataUrl, status: 'past' as const };
        }
        return { ...ev, extraPhotoDataUrl2: dataUrl, status: 'past' as const };
      });
      onChangeEvents(next);
    } catch {
      // ignore
    } finally {
      setQuickEventTargetId(null);
      e.target.value = '';
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim()) return;
    const safeDay = Math.max(1, Math.min(31, Number(evtDay) || 1));
    const safeEndDay = Math.max(safeDay, Math.min(31, Number(evtEndDay) || safeDay));
    const safeMonth = Math.max(1, Math.min(12, Number(evtMonth) || currentMonth));

    if (editingEventId) {
      const next = events.map((ev) =>
        ev.id === editingEventId
          ? {
              ...ev,
              title: evtTitle.trim(),
              day: safeDay,
              endDay: safeEndDay,
              month: safeMonth,
              timeRange: evtTimeRange.trim(),
              location: evtLocation.trim() || 'Rede SESI-PE',
              status: evtStatus,
              description: evtDescription.trim(),
              coverPhotoDataUrl: evtPhoto1 || undefined,
              extraPhotoDataUrl1: evtPhoto2 || undefined,
              extraPhotoDataUrl2: evtPhoto3 || undefined,
            }
          : ev
      );
      onChangeEvents(next);
    } else {
      const newEv: TeamMonthlyEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: evtTitle.trim(),
        day: safeDay,
        endDay: safeEndDay,
        month: safeMonth,
        timeRange: evtTimeRange.trim(),
        location: evtLocation.trim() || 'Rede SESI-PE',
        status: evtStatus,
        description: evtDescription.trim(),
        coverPhotoDataUrl: evtPhoto1 || undefined,
        extraPhotoDataUrl1: evtPhoto2 || undefined,
        extraPhotoDataUrl2: evtPhoto3 || undefined,
      };
      onChangeEvents([newEv, ...events]);
    }
    setEventModalOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    onChangeEvents(events.filter((ev) => ev.id !== id));
  };

  const activeMonthLabel =
    selectedMonth === 'ALL'
      ? 'Todos os Meses'
      : `Mês de ${MONTH_NAMES_PT[selectedMonth - 1]}`;

  return (
    <div className="space-y-4">
      <input
        ref={quickEventPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickEventPhotoChange}
      />

      {/* 1. CABEÇALHO HERO + VITRINE EM CARROSSEL DE EVENTOS DO MÊS E FOTOS DE EVENTOS PASSADOS */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#005F99] via-[#0077B6] to-[#009FE3] text-white border-2 border-b-8 border-sky-800 shadow-lg ${
          isTvMode ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
        }`}
      >
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Coluna Esquerda (7 cols): Título, Resumo da Equipe e Botões de Ação */}
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex flex-wrap items-center gap-2 text-xs font-extrabold text-amber-300 tracking-wide">
              <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
              <span>GESTÃO À VISTA DA EQUIPE SESI-PE · {activeMonthLabel.toUpperCase()}</span>
            </div>

            <h2
              className={`${
                isTvMode ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-3xl'
              } font-extrabold tracking-tight text-white`}
            >
              Agenda Mensal da Equipe & Eventos do Mês 📅
            </h2>

            <p className="text-xs sm:text-sm text-sky-100 leading-relaxed max-w-2xl">
              Acompanhe em tempo real <strong className="text-white">onde está cada colaborador da equipe</strong>{' '}
              (Sede GEDUC, visitas às 12 Escolas SESI, Eventos ou Home Office), a programação de{' '}
              <strong className="text-amber-200">Eventos do Mês</strong> e as{' '}
              <strong className="text-amber-200">Fotos dos Eventos Realizados</strong> no carrossel da TV!
            </p>

            {/* Placar de Localização da Equipe Hoje */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="rounded-2xl bg-white/12 border border-white/20 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-sky-200">Equipe Total</div>
                <div className="text-xl font-extrabold font-mono">{teamStats.total}</div>
              </div>
              <div className="rounded-2xl bg-sky-950/35 border border-sky-300/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-sky-200">Na Sede / GEDUC</div>
                <div className="text-xl font-extrabold font-mono text-sky-200">
                  {teamStats.sede}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-950/35 border border-emerald-300/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-emerald-200">
                  Nas Escolas SESI
                </div>
                <div className="text-xl font-extrabold font-mono text-emerald-300">
                  {teamStats.escola}
                </div>
              </div>
              <div className="rounded-2xl bg-amber-950/35 border border-amber-300/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-amber-200">
                  Eventos do Mês
                </div>
                <div className="text-xl font-extrabold font-mono text-amber-300">
                  {monthEvents.length}
                </div>
              </div>
            </div>

            {/* Botões de Ação: Cadastrar Minha Agenda, Cadastrar Evento + Fotos, Liberar Acesso Equipe */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => openNewScheduleModal()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-300 hover:bg-amber-200 text-amber-950 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-amber-500 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Cadastrar Agenda / Onde Estou</span>
              </button>

              <button
                type="button"
                onClick={() => openNewEventModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-emerald-600 transition-all cursor-pointer shadow-sm"
              >
                <Camera className="w-4 h-4 stroke-[2.5]" />
                <span>Novo Evento / Fotos Passadas</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessTeamModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 transition-colors cursor-pointer"
                title="Liberar acesso para os 17 colaboradores cadastrados no aniversário do mês editarem suas agendas"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Acesso dos Colaboradores ({members.length})</span>
              </button>
            </div>
          </div>

          {/* Coluna Direita (5 cols): Carrossel Animado de Eventos do Mês & Fotos de Eventos Passados */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl bg-white/12 backdrop-blur-md border-2 border-white/25 p-3.5 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Carrossel de Eventos & Fotos Realizadas</span>
                </div>
                {carouselSlides.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightIndex(
                          (prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length
                        )
                      }
                      className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-sky-100 px-1">
                      {(spotlightIndex % carouselSlides.length) + 1}/{carouselSlides.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightIndex((prev) => (prev + 1) % carouselSlides.length)
                      }
                      className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {currentSlide ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentSlide.event.id}-${
                      currentSlide.type === 'event_photo' ? currentSlide.photoIndex : 'card'
                    }`}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-2xl bg-slate-900/45 border border-white/20 overflow-hidden"
                  >
                    {currentSlide.type === 'event_photo' ? (
                      <div className="relative h-48 sm:h-52 w-full bg-slate-950">
                        <img
                          src={currentSlide.photoUrl}
                          alt={currentSlide.event.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-amber-300 text-amber-950 text-[10px] font-extrabold uppercase shadow-sm">
                          📸 Registro do Evento ({currentSlide.photoIndex}/{currentSlide.totalPhotos})
                        </div>
                        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-900/80 text-white text-[10px] font-mono font-extrabold">
                          {String(currentSlide.event.day).padStart(2, '0')}/
                          {String(currentSlide.event.month).padStart(2, '0')}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-3">
                          <div className="text-sm font-extrabold text-white truncate">
                            {currentSlide.event.title}
                          </div>
                          <div className="text-[11px] text-sky-200 flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                            <span className="truncate">{currentSlide.event.location}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                              currentSlide.event.status === 'today'
                                ? 'bg-amber-300 text-amber-950'
                                : currentSlide.event.status === 'past'
                                ? 'bg-emerald-300 text-emerald-950'
                                : 'bg-sky-200 text-sky-950'
                            }`}
                          >
                            {currentSlide.event.status === 'today'
                              ? '🎉 Acontecendo Hoje'
                              : currentSlide.event.status === 'past'
                              ? '✅ Evento Realizado'
                              : '📅 Próximo Evento do Mês'}
                          </span>
                          <span className="text-xs font-mono font-extrabold text-amber-300">
                            Dia {String(currentSlide.event.day).padStart(2, '0')}/
                            {String(currentSlide.event.month).padStart(2, '0')}
                            {currentSlide.event.endDay > currentSlide.event.day
                              ? ` a ${String(currentSlide.event.endDay).padStart(2, '0')}/${String(
                                  currentSlide.event.month
                                ).padStart(2, '0')}`
                              : ''}
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-white">
                          {currentSlide.event.title}
                        </div>
                        <div className="text-xs text-sky-100 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>{currentSlide.event.location}</span>
                          {currentSlide.event.timeRange && (
                            <>
                              <span>·</span>
                              <span>{currentSlide.event.timeRange}</span>
                            </>
                          )}
                        </div>
                        {currentSlide.event.description && (
                          <p className="text-xs text-sky-100/90 line-clamp-2">
                            {currentSlide.event.description}
                          </p>
                        )}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickEventTargetId(currentSlide.event.id);
                              quickEventPhotoInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-300/90 hover:bg-amber-300 text-amber-950 text-[11px] font-extrabold cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Adicionar Fotos deste Evento ao Carrossel</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="rounded-2xl bg-slate-900/30 border border-white/15 p-4 text-center space-y-2">
                  <PartyPopper className="w-7 h-7 text-amber-300 mx-auto" />
                  <div className="text-xs font-bold text-white">
                    Cadastre os Eventos do Mês e adicione fotos dos eventos passados para exibi-las no carrossel!
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewEventModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-300 text-amber-950 text-xs font-extrabold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Subir Fotos de Evento Passado</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTRO DE MESES, CATEGORIAS DE LOCALIZAÇÃO E CONTROLE DO CARROSSEL TV */}
      <div className="rounded-2xl bg-white border-2 border-b-4 border-sky-200 p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Seletor de Mês */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
          <button
            type="button"
            onClick={() => setSelectedMonth('ALL')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              selectedMonth === 'ALL'
                ? 'bg-[#009FE3] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ano Todo
          </button>
          {MONTH_NAMES_PT.map((mName, idx) => {
            const mNum = idx + 1;
            const isActive = selectedMonth === mNum;
            return (
              <button
                key={mName}
                type="button"
                onClick={() => setSelectedMonth(mNum)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#009FE3] text-white font-extrabold shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-sky-50 border border-slate-200/80'
                }`}
              >
                {mName.slice(0, 3)}
              </button>
            );
          })}
        </div>

        {/* Filtro Rápido de Visão + Controle do Carrossel TV */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubView('ambos')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                activeSubView === 'ambos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Equipe + Eventos
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('agendas')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                activeSubView === 'agendas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Só Agendas ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('eventos')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                activeSubView === 'eventos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Só Eventos & Fotos ({monthEvents.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1">
            <button
              type="button"
              onClick={() =>
                onChangeCarouselSettings({
                  ...carouselSettings,
                  enabled: !carouselSettings.enabled,
                })
              }
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                carouselSettings.enabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {carouselSettings.enabled ? (
                <Play className="w-3 h-3 fill-current" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
              <span>Carrossel TV: {carouselSettings.enabled ? 'Ativo' : 'Pausado'}</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToBirthdays}
              className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
            >
              🎂 Aniversariantes
            </button>
            <button
              type="button"
              onClick={onSwitchToEnrollments}
              className="px-2 py-1 rounded-lg bg-white hover:bg-sky-100 text-[#009FE3] border border-sky-200 text-xs font-bold cursor-pointer"
            >
              🏫 Matrículas 2027
            </button>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO DE EVENTOS DO MÊS & GALERIA DE FOTOS DE EVENTOS PASSADOS */}
      {(activeSubView === 'ambos' || activeSubView === 'eventos') && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#009FE3]" />
                <span>
                  Eventos do Mês & Galeria de Fotos dos Eventos Passados ({monthEvents.length})
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre os eventos programados do mês e adicione fotos dos eventos já realizados para passarem no carrossel da TV.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openNewEventModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-800" />
                <span>+ Fotos de Evento Passado</span>
              </button>
              <button
                type="button"
                onClick={() => openNewEventModal(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Evento do Mês</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {monthEvents.map((ev) => {
              const photos = [
                ev.coverPhotoDataUrl,
                ev.extraPhotoDataUrl1,
                ev.extraPhotoDataUrl2,
              ].filter(Boolean) as string[];

              return (
                <div
                  key={ev.id}
                  className="group rounded-3xl bg-white border-2 border-b-4 border-sky-200 hover:border-[#009FE3] shadow-xs overflow-hidden flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Galeria de Fotos do Evento (se houver) */}
                    {photos.length > 0 ? (
                      <div className="relative h-44 bg-slate-900 overflow-hidden">
                        <img
                          src={photos[0]}
                          alt={ev.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {photos.length > 1 && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/20">
                            {photos.slice(1).map((pUrl, i) => (
                              <img
                                key={i}
                                src={pUrl}
                                alt="Miniatura"
                                className="w-9 h-9 rounded-lg object-cover border border-white/40"
                              />
                            ))}
                          </div>
                        )}
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-amber-300 text-amber-950 text-[10px] font-extrabold uppercase shadow-xs">
                          📸 {photos.length} Foto(s) no Carrossel
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50 border-b border-slate-100 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded-2xl bg-[#009FE3]/10 border border-[#009FE3]/25 flex flex-col items-center justify-center text-[#009FE3]">
                            <span className="text-sm font-extrabold font-mono leading-none">
                              {String(ev.day).padStart(2, '0')}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase">
                              {MONTH_NAMES_PT[(ev.month || 1) - 1]?.slice(0, 3)}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                ev.status === 'today'
                                  ? 'bg-amber-300 text-amber-950'
                                  : ev.status === 'past'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-sky-100 text-sky-900'
                              }`}
                            >
                              {ev.status === 'today'
                                ? 'Acontecendo Hoje'
                                : ev.status === 'past'
                                ? 'Evento Realizado'
                                : 'Evento Programado'}
                            </span>
                            <div className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                              {ev.timeRange || 'Dia Todo'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setQuickEventTargetId(ev.id);
                            quickEventPhotoInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-extrabold cursor-pointer"
                          title="Enviar foto deste evento para o carrossel"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>+ Foto</span>
                        </button>
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                          {ev.title}
                        </h4>
                        <span className="text-xs font-mono font-extrabold text-[#009FE3] shrink-0">
                          {String(ev.day).padStart(2, '0')}/{String(ev.month).padStart(2, '0')}
                          {ev.endDay > ev.day
                            ? ` a ${String(ev.endDay).padStart(2, '0')}/${String(ev.month).padStart(
                                2,
                                '0'
                              )}`
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-[#009FE3] shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>

                      {ev.description && (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickEventTargetId(ev.id);
                        quickEventPhotoInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-900 hover:text-amber-700 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-700" />
                      <span>Adicionar Foto ao Carrossel</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditEventModal(ev)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#009FE3] hover:bg-sky-50 cursor-pointer"
                        title="Editar evento e fotos"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Excluir evento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. DASHBOARD DE TODOS OS COLABORADORES DA EQUIPE E SUAS AGENDAS MENSAIS ("ONDE ELES ESTÃO?") */}
      {(activeSubView === 'ambos' || activeSubView === 'agendas') && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#009FE3]" />
                <span>
                  Dashboard da Equipe — Onde Está Cada Colaborador & Agenda Mensal (
                  {collaboratorsWithSchedule.length})
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Todos os colaboradores cadastrados no Mural de Aniversariantes aparecem automaticamente aqui. Clique em qualquer colaborador para registrar sua agenda mensal!
              </p>
            </div>

            {/* Filtro por Localização */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold cursor-pointer ${
                  categoryFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                Todos ({members.length})
              </button>
              {(Object.keys(LOCATION_CATEGORY_META) as LocationCategory[]).map((catKey) => {
                const meta = LOCATION_CATEGORY_META[catKey];
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategoryFilter(catKey)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                      categoryFilter === catKey
                        ? `${meta.badgeBg} ${meta.badgeText} ${meta.border} font-extrabold`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grade de Cards de Todos os Colaboradores da Equipe */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${
              isTvMode ? 'xl:grid-cols-4 gap-3' : 'xl:grid-cols-4 gap-3.5'
            }`}
          >
            {collaboratorsWithSchedule.map(
              ({ member, schedules: memberScheds, effectiveCategory, effectiveLocation }) => {
                const catMeta = LOCATION_CATEGORY_META[effectiveCategory];
                const linkedEmail = collaboratorEmails[member.id] || '';

                return (
                  <div
                    key={member.id}
                    className="rounded-3xl bg-white border-2 border-b-4 border-sky-200 hover:border-[#009FE3] shadow-xs p-4 flex flex-col justify-between gap-3 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Topo: Foto do Colaborador + Nome + Setor + Botão Rápido +Agenda */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-[#009FE3] bg-sky-100 shrink-0 flex items-center justify-center font-extrabold text-[#009FE3]">
                            {member.photoDataUrl ? (
                              <img
                                src={member.photoDataUrl}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              member.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-slate-900 truncate">
                              {member.name}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 truncate">
                              {member.unitOrSector || 'Equipe GEDUC / SESI-PE'}
                            </div>
                            {linkedEmail && (
                              <div className="text-[10px] font-mono text-emerald-700 truncate">
                                ✓ {linkedEmail}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openNewScheduleModal(member.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-[#009FE3] text-[#009FE3] hover:text-white border border-sky-200 text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                          title={`Adicionar compromisso na agenda mensal de ${member.name}`}
                        >
                          + Agenda
                        </button>
                      </div>

                      {/* Onde Está Hoje / Localização Atual */}
                      <div
                        className={`rounded-2xl p-2.5 border ${catMeta.badgeBg} ${catMeta.border} space-y-1`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider ${catMeta.badgeText}`}
                          >
                            📍 {catMeta.shortLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => openNewScheduleModal(member.id)}
                            className="text-[10px] font-bold underline text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Alterar local
                          </button>
                        </div>
                        <div className={`text-xs font-extrabold ${catMeta.badgeText} truncate`}>
                          {effectiveLocation}
                        </div>
                      </div>

                      {/* Compromissos da Agenda Mensal deste Colaborador */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          <span>Programação no Mês ({memberScheds.length})</span>
                        </div>

                        {memberScheds.length === 0 ? (
                          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-2.5 text-[11px] text-slate-500 text-center">
                            Atuação padrão na Sede / GEDUC.{' '}
                            <button
                              type="button"
                              onClick={() => openNewScheduleModal(member.id)}
                              className="font-extrabold text-[#009FE3] underline cursor-pointer"
                            >
                              Registrar saída/visita
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                            {memberScheds.map((item) => {
                              const itemMeta = LOCATION_CATEGORY_META[item.locationCategory];
                              return (
                                <div
                                  key={item.id}
                                  className="group/sched rounded-xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200/90 p-2 text-xs flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-[#009FE3] text-white font-mono text-[10px] font-extrabold">
                                        {String(item.day).padStart(2, '0')}/
                                        {String(item.month).padStart(2, '0')}
                                        {item.endDay > item.day
                                          ? `-${String(item.endDay).padStart(2, '0')}`
                                          : ''}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${itemMeta.badgeBg} ${itemMeta.badgeText}`}
                                      >
                                        {item.locationName}
                                      </span>
                                    </div>
                                    {item.activity && (
                                      <div className="text-[11px] text-slate-600 line-clamp-1">
                                        {item.activity}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-slate-400 font-semibold">
                                      {item.shift}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-0.5 opacity-80 group-hover/sched:opacity-100 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openEditScheduleModal(item)}
                                      className="p-1 rounded text-slate-400 hover:text-[#009FE3] cursor-pointer"
                                      title="Editar compromisso"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSchedule(item.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                      title="Remover compromisso"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* MODAL 1: CADASTRAR / EDITAR AGENDA MENSAL DO COLABORADOR */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setScheduleModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#009FE3]">
                  Agenda Mensal da Equipe SESI-PE
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingScheduleId
                    ? 'Editar Compromisso / Localização'
                    : 'Cadastrar Agenda / Onde Estou'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  1. Colaborador da Equipe (Cadastrados no Mural):
                </label>
                <select
                  value={schedMemberId}
                  onChange={(e) => setSchedMemberId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-extrabold bg-sky-50/70 border-2 border-sky-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.unitOrSector ? `(${m.unitOrSector})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dia Início:</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={schedDay}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setSchedDay(d);
                      if (schedEndDay < d) setSchedEndDay(d);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-extrabold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dia Fim:</label>
                  <input
                    type="number"
                    min={schedDay}
                    max={31}
                    value={schedEndDay}
                    onChange={(e) => setSchedEndDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-extrabold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mês:</label>
                  <select
                    value={schedMonth}
                    onChange={(e) => setSchedMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    {MONTH_NAMES_PT.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  2. Tipo de Localização / Status:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(Object.keys(LOCATION_CATEGORY_META) as LocationCategory[]).map((cat) => {
                    const meta = LOCATION_CATEGORY_META[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSchedCategory(cat);
                          if (cat === 'sede')
                            setSchedLocationName('Sede Educação (GEDUC - Recife)');
                          if (cat === 'home_office') setSchedLocationName('Home Office (Remoto)');
                          if (cat === 'ferias') setSchedLocationName('Férias / Folga Programada');
                        }}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left cursor-pointer transition-all ${
                          schedCategory === cat
                            ? `${meta.badgeBg} ${meta.badgeText} ${meta.border} font-extrabold ring-2 ring-[#009FE3]/40`
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  3. Escola SESI / Local onde estará:
                </label>
                <input
                  type="text"
                  list="sesi-quick-locations"
                  value={schedLocationName}
                  onChange={(e) => setSchedLocationName(e.target.value)}
                  placeholder="Ex.: Escola SESI Paulista, Sede GEDUC, Caruaru..."
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
                />
                <datalist id="sesi-quick-locations">
                  {QUICK_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turno / Horário:
                  </label>
                  <select
                    value={schedShift}
                    onChange={(e) => setSchedShift(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="Dia Todo (08h às 17h)">Dia Todo (08h às 17h)</option>
                    <option value="Turno da Manhã (08h às 12h)">Turno da Manhã (08h às 12h)</option>
                    <option value="Turno da Tarde (13h às 17h)">Turno da Tarde (13h às 17h)</option>
                    <option value="Plantão Matrículas">Plantão Matrículas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Atividade / Missão:
                  </label>
                  <input
                    type="text"
                    value={schedActivity}
                    onChange={(e) => setSchedActivity(e.target.value)}
                    placeholder="Ex.: Visita técnica / Apoio Matrículas"
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar na Agenda da Equipe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CADASTRAR / EDITAR EVENTO DO MÊS E FOTOS DE EVENTOS PASSADOS */}
      {eventModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setEventModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#009FE3]">
                  Programação Mensal & Memória Fotográfica no Carrossel
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingEventId
                    ? 'Editar Evento do Mês & Fotos'
                    : 'Cadastrar Evento do Mês / Fotos de Evento Passado'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nome do Evento / Ação:
                </label>
                <input
                  type="text"
                  required
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  placeholder="Ex.: Dia D de Matrículas SESI 2027 / Encontro Pedagógico da Equipe"
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dia Início:</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={evtDay}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setEvtDay(d);
                      if (evtEndDay < d) setEvtEndDay(d);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-extrabold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dia Fim:</label>
                  <input
                    type="number"
                    min={evtDay}
                    max={31}
                    value={evtEndDay}
                    onChange={(e) => setEvtEndDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-extrabold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mês:</label>
                  <select
                    value={evtMonth}
                    onChange={(e) => setEvtMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  >
                    {MONTH_NAMES_PT.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Local / Unidade Escolar:
                  </label>
                  <input
                    type="text"
                    list="sesi-quick-locations"
                    value={evtLocation}
                    onChange={(e) => setEvtLocation(e.target.value)}
                    placeholder="Ex.: Todas as 12 Escolas SESI-PE"
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status do Evento:
                  </label>
                  <select
                    value={evtStatus}
                    onChange={(e) =>
                      setEvtStatus(e.target.value as 'upcoming' | 'today' | 'past')
                    }
                    className="w-full px-3 py-2 text-xs font-extrabold bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="upcoming">📅 Próximo Evento (Programado)</option>
                    <option value="today">🎉 Acontecendo Hoje</option>
                    <option value="past">📸 Evento Passado (Com Fotos no Carrossel)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição / Destaques do Evento:
                </label>
                <textarea
                  rows={2}
                  value={evtDescription}
                  onChange={(e) => setEvtDescription(e.target.value)}
                  placeholder="Resumo do que teremos no evento ou como foi a participação da equipe..."
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
                />
              </div>

              {/* Upload de até 3 Fotos do Evento Passado para ficar no Carrossel */}
              <div className="rounded-2xl bg-amber-50/80 border-2 border-dashed border-amber-300 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-700" />
                      <span>Fotos do Evento Passado / Realizado (Exibidas no Carrossel da TV)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Selecione até 3 fotos do evento para passarem automaticamente no carrossel!
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-300 hover:bg-amber-200 text-amber-950 text-xs font-extrabold cursor-pointer shrink-0 shadow-xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{uploadingPhoto ? 'Processando...' : 'Escolher Fotos'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEventFilesUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {(evtPhoto1 || evtPhoto2 || evtPhoto3) && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { val: evtPhoto1, clear: () => setEvtPhoto1('') },
                      { val: evtPhoto2, clear: () => setEvtPhoto2('') },
                      { val: evtPhoto3, clear: () => setEvtPhoto3('') },
                    ].map((slot, idx) =>
                      slot.val ? (
                        <div
                          key={idx}
                          className="relative h-24 rounded-xl overflow-hidden border-2 border-amber-400 bg-slate-900"
                        >
                          <img
                            src={slot.val}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={slot.clear}
                            className="absolute top-1 right-1 p-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                            title="Remover foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Evento no Mural & Carrossel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LIBERAR ACESSO PARA OS COLABORADORES DO ANIVERSÁRIO DO MÊS CADASTRAREM SUAS AGENDAS */}
      {accessTeamModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setAccessTeamModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#009FE3]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Permissão de Agenda para os Colaboradores da Equipe</span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Liberar Acesso aos Colaboradores Cadastrados ({members.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Vincule o e-mail Google de cada colaborador cadastrado no Mural de Aniversariantes para que ele já fique pré-aprovado a entrar e atualizar sua própria agenda mensal!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccessTeamModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {savedAccessBanner && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-extrabold text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{savedAccessBanner}</span>
              </div>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-[55vh] overflow-y-auto">
              {members.map((m) => {
                const emailVal = collaboratorEmails[m.id] || '';
                return (
                  <div
                    key={m.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-sky-100 border border-[#009FE3] shrink-0 flex items-center justify-center text-xs font-extrabold text-[#009FE3]">
                        {m.photoDataUrl ? (
                          <img
                            src={m.photoDataUrl}
                            alt={m.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          m.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Aniversário: {String(m.day).padStart(2, '0')}/
                          {String(m.month).padStart(2, '0')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:w-80">
                      <input
                        type="email"
                        value={emailVal}
                        onChange={(e) => {
                          const next = {
                            ...collaboratorEmails,
                            [m.id]: e.target.value,
                          };
                          onChangeCollaboratorEmails(next);
                        }}
                        placeholder="E-mail Google do colaborador..."
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#009FE3]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const clean = (collaboratorEmails[m.id] || '').trim().toLowerCase();
                          if (!clean || !clean.includes('@')) return;
                          if (onPreApproveCollaboratorEmail) {
                            await onPreApproveCollaboratorEmail(clean, m.name);
                          }
                          setSavedAccessBanner(
                            `Acesso liberado para ${m.name} (${clean}) cadastrar sua agenda!`
                          );
                          setTimeout(() => setSavedAccessBanner(null), 4000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
                      >
                        Liberar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Dica: O colaborador também pode clicar direto em <strong>+ Agenda</strong> no seu card para informar onde estará no mês.
              </span>
              <button
                type="button"
                onClick={() => setAccessTeamModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
