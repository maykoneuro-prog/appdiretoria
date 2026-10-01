import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cake,
  PartyPopper,
  Plus,
  Camera,
  Trash2,
  Pencil,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Upload,
  Building2,
  Heart,
  Tv,
  Play,
  Pause,
  Search,
} from 'lucide-react';

export interface BirthdayMember {
  id: string;
  name: string;
  day: number; // 1..31
  month: number; // 1..12
  birthYear?: number;
  photoDataUrl?: string;
  unitOrSector?: string;
  message?: string;
  avatarGradient?: string;
}

export interface TvCarouselSettings {
  enabled: boolean;
  intervalSeconds: number;
}

export const MONTH_NAMES_PT = [
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

export const MONTH_SHORT_PT = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-violet-400 to-indigo-600',
  'from-cyan-400 to-sky-600',
];

const UNIT_SUGGESTIONS = [
  'Diretoria / Sede Educação',
  'SESI Araripina',
  'SESI Belo Jardim',
  'SESI Cabo',
  'SESI Camaragibe',
  'SESI Caruaru',
  'SESI Escada',
  'SESI Goiana',
  'SESI Ibura',
  'SESI Moreno',
  'SESI Paulista',
  'SESI Petrolina',
  'SESI Vasco da Gama',
];

export const BIRTHDAYS_STORAGE_KEY = 'sesi_pe_team_birthdays_v1';
export const TV_CAROUSEL_STORAGE_KEY = 'sesi_pe_tv_carousel_settings_v1';

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function compressAndCropImageToDataUrl(file: File, size = 440): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas não suportado'));
          return;
        }
        // Crop quadrado centralizado focando levemente no topo (rosto)
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = Math.max(0, (img.height - minSide) * 0.25);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

interface TeamBirthdaysMuralProps {
  members: BirthdayMember[];
  onChangeMembers: (next: BirthdayMember[]) => void;
  carouselSettings: TvCarouselSettings;
  onChangeCarouselSettings: (next: TvCarouselSettings) => void;
  isTvMode?: boolean;
  onToggleTvMode?: () => void;
  onSwitchToEnrollments?: () => void;
}

// Partículas festivas animadas (compositor-only: transform & opacity)
const FLOATING_CONFETTI = [
  { id: 1, left: '6%', delay: 0, duration: 6.5, color: 'bg-amber-300', size: 'w-3 h-3 rounded-full' },
  { id: 2, left: '16%', delay: 1.2, duration: 7.2, color: 'bg-sky-300', size: 'w-4 h-2 rounded-xs rotate-12' },
  { id: 3, left: '28%', delay: 0.5, duration: 6.8, color: 'bg-emerald-300', size: 'w-2.5 h-2.5 rounded-full' },
  { id: 4, left: '42%', delay: 2.1, duration: 7.5, color: 'bg-rose-300', size: 'w-3.5 h-2 rounded-xs -rotate-12' },
  { id: 5, left: '58%', delay: 0.8, duration: 6.4, color: 'bg-amber-200', size: 'w-3 h-3 rounded-full' },
  { id: 6, left: '72%', delay: 1.7, duration: 7.1, color: 'bg-white/70', size: 'w-2.5 h-2.5 rounded-full' },
  { id: 7, left: '84%', delay: 0.3, duration: 6.9, color: 'bg-emerald-200', size: 'w-4 h-2 rounded-xs rotate-45' },
  { id: 8, left: '93%', delay: 1.5, duration: 6.2, color: 'bg-amber-300', size: 'w-3 h-3 rounded-full' },
];

export const TeamBirthdaysMural: React.FC<TeamBirthdaysMuralProps> = ({
  members,
  onChangeMembers,
  carouselSettings,
  onChangeCarouselSettings,
  isTvMode = false,
  onSwitchToEnrollments,
}) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1..12
  const currentDay = now.getDate();

  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isSpotlightPaused, setIsSpotlightPaused] = useState(false);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  // Estado do Modal de Cadastro / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [dayInput, setDayInput] = useState<number>(currentDay);
  const [monthInput, setMonthInput] = useState<number>(currentMonth);
  const [datePickerValue, setDatePickerValue] = useState<string>('');
  const [unitInput, setUnitInput] = useState('');
  const [messageInput, setMessageInput] = useState(
    'Parabéns pelo seu dia! Desejamos muita saúde, alegria e sucesso em sua caminhada!'
  );
  const [photoDataUrlInput, setPhotoDataUrlInput] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [quickPhotoTargetId, setQuickPhotoTargetId] = useState<string | null>(null);

  // Filtra os aniversariantes do mês selecionado (ou todos) e ordena por dia
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members
      .filter((m) => {
        if (selectedMonth !== 'ALL' && m.month !== selectedMonth) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          (m.unitOrSector || '').toLowerCase().includes(q) ||
          String(m.day).padStart(2, '0').includes(q)
        );
      })
      .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, 'pt-BR'));
  }, [members, selectedMonth, searchQuery]);

  // Aniversariantes de HOJE
  const todaysBirthdays = useMemo(() => {
    return members.filter((m) => m.month === currentMonth && m.day === currentDay);
  }, [members, currentMonth, currentDay]);

  // Contagem por mês (1..12)
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) counts[i] = 0;
    for (const m of members) {
      if (m.month >= 1 && m.month <= 12) {
        counts[m.month] = (counts[m.month] || 0) + 1;
      }
    }
    return counts;
  }, [members]);

  // Lista usada no Destaque Animado (prioriza os do mês selecionado; se vazio, usa todos)
  const spotlightPool = useMemo(() => {
    if (filteredMembers.length > 0) return filteredMembers;
    return [...members].sort((a, b) => a.month - b.month || a.day - b.day);
  }, [filteredMembers, members]);

  useEffect(() => {
    if (spotlightIndex >= spotlightPool.length) {
      setSpotlightIndex(0);
    }
  }, [spotlightPool.length, spotlightIndex]);

  // Rotação automática do cartão de Destaque (Spotlight) a cada 6 segundos
  useEffect(() => {
    if (isSpotlightPaused || spotlightPool.length <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightPool.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isSpotlightPaused, spotlightPool.length]);

  const activeSpotlight = spotlightPool[spotlightIndex] || null;

  const openNewModal = () => {
    setEditingMemberId(null);
    setNameInput('');
    const defaultMonth = selectedMonth === 'ALL' ? currentMonth : selectedMonth;
    setDayInput(currentDay);
    setMonthInput(defaultMonth);
    setDatePickerValue(
      `2000-${String(defaultMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`
    );
    setUnitInput('');
    setMessageInput(
      'Parabéns pelo seu dia! Desejamos muita saúde, alegria e sucesso em sua caminhada!'
    );
    setPhotoDataUrlInput('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (member: BirthdayMember) => {
    setEditingMemberId(member.id);
    setNameInput(member.name);
    setDayInput(member.day);
    setMonthInput(member.month);
    const yr = member.birthYear || 2000;
    setDatePickerValue(
      `${yr}-${String(member.month).padStart(2, '0')}-${String(member.day).padStart(2, '0')}`
    );
    setUnitInput(member.unitOrSector || '');
    setMessageInput(
      member.message ||
        'Parabéns pelo seu dia! Desejamos muita saúde, alegria e sucesso em sua caminhada!'
    );
    setPhotoDataUrlInput(member.photoDataUrl || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setFormError(null);
    try {
      const dataUrl = await compressAndCropImageToDataUrl(file, 440);
      setPhotoDataUrlInput(dataUrl);
    } catch {
      setFormError('Não foi possível processar esta imagem. Tente outro arquivo JPG ou PNG.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleQuickPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickPhotoTargetId) return;
    try {
      const dataUrl = await compressAndCropImageToDataUrl(file, 440);
      const next = members.map((m) =>
        m.id === quickPhotoTargetId ? { ...m, photoDataUrl: dataUrl } : m
      );
      onChangeMembers(next);
    } catch {
      // ignore
    } finally {
      setQuickPhotoTargetId(null);
      e.target.value = '';
    }
  };

  const handleDateInputPick = (val: string) => {
    setDatePickerValue(val);
    const parts = val.split('-');
    if (parts.length === 3) {
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (m >= 1 && m <= 12) setMonthInput(m);
      if (d >= 1 && d <= 31) setDayInput(d);
    }
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setFormError('Por favor, informe o nome do aniversariante.');
      return;
    }
    const safeDay = Math.max(1, Math.min(31, Number(dayInput) || 1));
    const safeMonth = Math.max(1, Math.min(12, Number(monthInput) || currentMonth));

    if (editingMemberId) {
      const next = members.map((m) =>
        m.id === editingMemberId
          ? {
              ...m,
              name: cleanName,
              day: safeDay,
              month: safeMonth,
              unitOrSector: unitInput.trim(),
              message: messageInput.trim(),
              photoDataUrl: photoDataUrlInput || undefined,
            }
          : m
      );
      onChangeMembers(next);
    } else {
      const newMember: BirthdayMember = {
        id: `bday-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        day: safeDay,
        month: safeMonth,
        unitOrSector: unitInput.trim(),
        message:
          messageInput.trim() ||
          'Parabéns pelo seu dia! Desejamos muita saúde, alegria e sucesso em sua caminhada!',
        photoDataUrl: photoDataUrlInput || undefined,
        avatarGradient: AVATAR_GRADIENTS[members.length % AVATAR_GRADIENTS.length],
      };
      onChangeMembers([...members, newMember]);
      // Se o mês selecionado for diferente do mês recém-cadastrado, muda para o mês dele
      if (selectedMonth !== 'ALL' && selectedMonth !== safeMonth) {
        setSelectedMonth(safeMonth);
      }
    }
    setModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    onChangeMembers(members.filter((m) => m.id !== id));
  };

  const triggerCelebrateCard = (id: string) => {
    setCelebratingId(id);
    setTimeout(() => {
      setCelebratingId((prev) => (prev === id ? null : prev));
    }, 2200);
  };

  const activeMonthTitle =
    selectedMonth === 'ALL'
      ? 'Todos os Meses do Ano'
      : `Mês de ${MONTH_NAMES_PT[selectedMonth - 1]}`;

  return (
    <div className="space-y-4">
      {/* Input oculto para trocar foto direto no card com 1 clique */}
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickPhotoChange}
      />

      {/* 1. HERO FESTIVO COM ANIMAÇÃO DE CONFETES E DESTAQUE AUTOMÁTICO */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0077B6] via-[#009FE3] to-[#0284C7] text-white border-2 border-b-8 border-sky-700 shadow-lg ${
          isTvMode ? 'p-4 sm:p-5' : 'p-5 sm:p-7'
        }`}
      >
        {/* Partículas e Confetes Flutuantes (Animação suave para TV) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {FLOATING_CONFETTI.map((item) => (
            <motion.div
              key={item.id}
              className={`absolute -top-4 ${item.size} ${item.color} opacity-75`}
              style={{ left: item.left }}
              animate={{
                y: [0, 340],
                rotate: [0, 180, 360],
                opacity: [0, 0.85, 0.85, 0],
              }}
              transition={{
                duration: item.duration,
                repeat: Infinity,
                delay: item.delay,
                ease: 'linear',
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Coluna Esquerda: Título do Mural + Controles Rápidos */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex flex-wrap items-center gap-2 text-xs font-extrabold text-amber-300 tracking-wide">
              <Cake className="w-4 h-4 text-amber-300 shrink-0" />
              <span>REDE SESI EDUCAÇÃO DE PERNAMBUCO · NOSSA EQUIPE</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-100">{activeMonthTitle.toUpperCase()}</span>
            </div>

            <h2
              className={`${
                isTvMode ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-4xl'
              } font-extrabold tracking-tight text-white`}
              style={{ textWrap: 'balance' }}
            >
              Mural de Aniversariantes do Mês 🎉
            </h2>

            <p className="text-xs sm:text-sm text-sky-100 leading-relaxed max-w-xl">
              Celebrando a vida e a dedicação de quem constrói diariamente o sucesso das nossas
              escolas e da campanha de matrículas SESI-PE!
            </p>

            {/* Banner especial se houver aniversariante(s) HOJE */}
            {todaysBirthdays.length > 0 && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex flex-wrap items-center gap-2.5 px-4 py-2 rounded-2xl bg-amber-300 text-amber-950 font-extrabold text-xs sm:text-sm shadow-md border-2 border-white"
              >
                <PartyPopper className="w-4 h-4 text-amber-900 animate-bounce shrink-0" />
                <span>
                  HOJE ({String(currentDay).padStart(2, '0')}/
                  {String(currentMonth).padStart(2, '0')}) É ANIVERSÁRIO DE:{' '}
                  <strong className="underline decoration-amber-800">
                    {todaysBirthdays.map((b) => b.name).join(', ')}
                  </strong>
                  ! Parabéns! 🎂👏
                </span>
              </motion.div>
            )}

            {/* Botões de Ação (Cadastrar Aniversariante + Configurar Carrossel Modo TV) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-300 hover:bg-amber-200 text-amber-950 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-amber-500 transition-transform active:scale-95 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Cadastrar Aniversariante + Foto
              </button>

              {/* Controle do Carrossel Automático com o Painel de Matrículas no Modo TV */}
              <div className="inline-flex flex-wrap items-center gap-1.5 bg-sky-950/40 backdrop-blur-xs border border-white/25 rounded-2xl px-3 py-1.5 text-xs">
                <Tv className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="font-bold text-sky-100 whitespace-nowrap">
                  Carrossel na TV (Matrículas ⇄ Aniversariantes):
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeCarouselSettings({
                      ...carouselSettings,
                      enabled: !carouselSettings.enabled,
                    })
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                    carouselSettings.enabled
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {carouselSettings.enabled ? (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      Ativo
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      Pausado
                    </>
                  )}
                </button>

                <select
                  value={carouselSettings.intervalSeconds}
                  onChange={(e) =>
                    onChangeCarouselSettings({
                      ...carouselSettings,
                      intervalSeconds: Number(e.target.value) || 25,
                    })
                  }
                  className="bg-sky-900/80 text-white font-mono font-bold text-xs rounded-xl px-2 py-1 border border-white/20 focus:outline-none cursor-pointer"
                  title="Tempo de exibição de cada tela quando o Modo TV estiver ativo"
                >
                  <option value={15}>a cada 15s</option>
                  <option value={25}>a cada 25s</option>
                  <option value={35}>a cada 35s</option>
                  <option value={45}>a cada 45s</option>
                  <option value={60}>a cada 60s</option>
                </select>
              </div>

              {onSwitchToEnrollments && (
                <button
                  type="button"
                  onClick={onSwitchToEnrollments}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Ver Painel de Matrículas 2027
                </button>
              )}
            </div>
          </div>

          {/* Coluna Direita: Cartão de Destaque Animado (Spotlight Rotativo de Aniversariantes) */}
          {activeSpotlight ? (
            <div
              className="w-full lg:w-[440px] shrink-0"
              onMouseEnter={() => setIsSpotlightPaused(true)}
              onMouseLeave={() => setIsSpotlightPaused(false)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSpotlight.id}
                  initial={{ opacity: 0, x: 24, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-3xl bg-white text-slate-900 p-4 sm:p-5 border-2 border-b-6 border-amber-300 shadow-xl flex items-center gap-4"
                >
                  {/* Foto em Destaque com Moldura Festiva */}
                  <div className="relative shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-amber-300 shadow-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      {activeSpotlight.photoDataUrl ? (
                        <img
                          src={activeSpotlight.photoDataUrl}
                          alt={activeSpotlight.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-extrabold text-white tracking-wider">
                          {getInitials(activeSpotlight.name)}
                        </span>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-xl bg-amber-400 text-amber-950 font-mono font-extrabold text-xs shadow-sm border-2 border-white">
                      {String(activeSpotlight.day).padStart(2, '0')}/
                      {MONTH_SHORT_PT[activeSpotlight.month - 1]}
                    </div>
                  </div>

                  {/* Dados do Aniversariante em Destaque */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#009FE3] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                        {activeSpotlight.month === currentMonth &&
                        activeSpotlight.day === currentDay
                          ? 'Aniversariante de Hoje!'
                          : 'Destaque da Equipe'}
                      </span>
                      {spotlightPool.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSpotlightIndex(
                                (prev) => (prev - 1 + spotlightPool.length) % spotlightPool.length
                              )
                            }
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                            title="Anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {spotlightIndex + 1}/{spotlightPool.length}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSpotlightIndex((prev) => (prev + 1) % spotlightPool.length)
                            }
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                            title="Próximo"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                      {activeSpotlight.name}
                    </h3>

                    {activeSpotlight.unitOrSector && (
                      <div className="text-xs font-bold text-slate-600 truncate">
                        {activeSpotlight.unitOrSector}
                      </div>
                    )}

                    <p className="text-xs text-slate-600 line-clamp-2 italic pt-0.5">
                      “
                      {activeSpotlight.message ||
                        'Parabéns pelo seu dia! Muita saúde, alegria e realizações!'}
                      ”
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div className="w-full lg:w-[400px] shrink-0 rounded-3xl bg-white/10 backdrop-blur-xs border-2 border-dashed border-white/35 p-5 text-center space-y-2">
              <Cake className="w-8 h-8 text-amber-300 mx-auto" />
              <div className="text-sm font-extrabold text-white">
                Comece seu Mural de Aniversariantes!
              </div>
              <p className="text-xs text-sky-100">
                Clique em <strong>Cadastrar Aniversariante + Foto</strong> ao lado para adicionar a
                equipe com foto, nome e data de nascimento.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. BARRA DE MESES (JANEIRO A DEZEMBRO) + BUSCA RÁPIDA */}
      <div className="rounded-2xl bg-white border-2 border-b-4 border-sky-200 p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Seletor dos 12 Meses */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
          <Calendar className="w-4 h-4 text-[#009FE3] shrink-0 mr-1" />
          <button
            type="button"
            onClick={() => setSelectedMonth('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'bg-[#009FE3] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({members.length})
          </button>
          {MONTH_SHORT_PT.map((shortLabel, idx) => {
            const mNum = idx + 1;
            const count = monthCounts[mNum] || 0;
            const isCurrent = mNum === currentMonth;
            const isSelected = selectedMonth === mNum;
            return (
              <button
                key={mNum}
                type="button"
                onClick={() => setSelectedMonth(mNum)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-[#009FE3] text-white shadow-xs'
                    : isCurrent
                    ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={`${MONTH_NAMES_PT[idx]} (${count} aniversariante${count === 1 ? '' : 's'})`}
              >
                <span>{shortLabel}</span>
                {count > 0 && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Busca + Botão Rápido de Adicionar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nome ou unidade..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
            />
          </div>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Aniversariante
          </button>
        </div>
      </div>

      {/* 3. GRADE DE CARTÕES ANIMADOS DOS ANIVERSARIANTES DO MÊS */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-3xl bg-white border-2 border-dashed border-sky-300 p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Cake className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            Nenhum aniversariante cadastrado em{' '}
            {selectedMonth === 'ALL' ? 'sua lista' : MONTH_NAMES_PT[selectedMonth - 1]}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Adicione as fotos, nomes e datas de nascimento da sua equipe para exibir neste mural
            comemorativo e no carrossel automático da TV!
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#009FE3] hover:bg-sky-600 text-white font-extrabold text-xs sm:text-sm border-2 border-b-4 border-sky-700 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Cadastrar Primeiro Aniversariante com Foto
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            isTvMode
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {filteredMembers.map((member, idx) => {
            const isToday = member.month === currentMonth && member.day === currentDay;
            const isCelebrating = celebratingId === member.id;
            const gradientClass =
              member.avatarGradient || AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(idx * 0.04, 0.4),
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ y: -4 }}
                className={`group relative rounded-3xl bg-white border-2 border-b-6 transition-shadow ${
                  isToday
                    ? 'border-amber-400 shadow-lg ring-2 ring-amber-300/60'
                    : 'border-sky-200 hover:border-[#009FE3] shadow-xs hover:shadow-md'
                } p-4 flex flex-col items-center text-center`}
              >
                {/* Topo do Card: Data de Aniversário + Ações de Editar/Excluir */}
                <div className="w-full flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-mono font-extrabold tabular-nums ${
                      isToday ? 'text-amber-700' : 'text-[#009FE3]'
                    }`}
                  >
                    <Cake className="w-3.5 h-3.5 shrink-0" />
                    {String(member.day).padStart(2, '0')} de {MONTH_NAMES_PT[member.month - 1]}
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEditModal(member)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                      title="Editar nome, data ou foto"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(member.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remover aniversariante"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Moldura da Foto do Aniversariante com Botão de Upload Rápido */}
                <div className="relative my-1.5">
                  <motion.div
                    animate={
                      isToday || isCelebrating
                        ? { scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }
                        : undefined
                    }
                    transition={{ duration: 0.8 }}
                    className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 ${
                      isToday ? 'border-amber-400' : 'border-sky-200 group-hover:border-[#009FE3]'
                    } shadow-md bg-gradient-to-br ${gradientClass} flex items-center justify-center relative`}
                  >
                    {member.photoDataUrl ? (
                      <img
                        src={member.photoDataUrl}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-extrabold text-white tracking-wider select-none">
                        {getInitials(member.name)}
                      </span>
                    )}

                    {/* Overlay para trocar/enviar foto rapidamente */}
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPhotoTargetId(member.id);
                        quickPhotoInputRef.current?.click();
                      }}
                      className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-extrabold gap-1 cursor-pointer"
                      title="Clique para enviar ou trocar a foto"
                    >
                      <Camera className="w-5 h-5 text-amber-300" />
                      <span>{member.photoDataUrl ? 'Trocar Foto' : 'Enviar Foto'}</span>
                    </button>
                  </motion.div>

                  {isToday && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-lg bg-amber-400 text-amber-950 font-extrabold text-[10px] uppercase tracking-wider shadow-xs whitespace-nowrap border border-white">
                      🎉 Hoje!
                    </span>
                  )}
                </div>

                {/* Nome e Unidade/Setor */}
                <h4 className="mt-2 text-base font-extrabold text-slate-900 line-clamp-1">
                  {member.name}
                </h4>

                <div className="text-xs font-semibold text-slate-500 line-clamp-1 mt-0.5">
                  {member.unitOrSector || 'Equipe SESI Educação PE'}
                </div>

                {member.message && (
                  <p className="mt-2 text-xs text-slate-600 italic line-clamp-2 leading-relaxed">
                    “{member.message}”
                  </p>
                )}

                {/* Botão Interativo de Parabenizar */}
                <div className="mt-auto pt-3 w-full">
                  <button
                    type="button"
                    onClick={() => triggerCelebrateCard(member.id)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                      isCelebrating
                        ? 'bg-amber-300 text-amber-950'
                        : 'bg-sky-50 hover:bg-sky-100 text-[#009FE3]'
                    }`}
                  >
                    {isCelebrating ? (
                      <>
                        <PartyPopper className="w-3.5 h-3.5 text-amber-800 animate-bounce" />
                        Parabéns Enviado! 🎉
                      </>
                    ) : (
                      <>
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        Celebrar Aniversário
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL DE CADASTRO / EDIÇÃO COM UPLOAD DE FOTO */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-extrabold text-[#009FE3] uppercase tracking-wider">
                  Mural Comemorativo · Equipe SESI-PE
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingMemberId ? 'Editar Aniversariante' : 'Cadastrar Aniversariante do Mês'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4">
              {/* Upload de Foto com Preview */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#009FE3] bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  {photoDataUrlInput ? (
                    <img
                      src={photoDataUrlInput}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-8 h-8 text-white/90" />
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="text-xs font-extrabold text-slate-800">
                    Foto do Aniversariante
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Envie uma foto do computador ou celular (recorte quadrado automático para ficar
                    perfeito na TV).
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingPhoto
                        ? 'Processando...'
                        : photoDataUrlInput
                        ? 'Trocar Foto'
                        : 'Escolher Foto'}
                    </button>
                    {photoDataUrlInput && (
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrlInput('')}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Nome do Aniversariante */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Nome do Colaborador(a) *
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ex.: Maria Clara Silva"
                  className="w-full px-3.5 py-2 text-sm font-bold text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                />
              </div>

              {/* Data de Nascimento: Seletor Dia + Mês ou Calendário */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Dia do Aniversário *
                  </label>
                  <select
                    value={dayInput}
                    onChange={(e) => setDayInput(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Dia {String(d).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Mês de Nascimento *
                  </label>
                  <select
                    value={monthInput}
                    onChange={(e) => setMonthInput(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                  >
                    {MONTH_NAMES_PT.map((mName, idx) => (
                      <option key={mName} value={idx + 1}>
                        {String(idx + 1).padStart(2, '0')} - {mName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Ou Escolha no Calendário
                  </label>
                  <input
                    type="date"
                    value={datePickerValue}
                    onChange={(e) => handleDateInputPick(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono font-bold text-slate-700 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                  />
                </div>
              </div>

              {/* Unidade Escolar / Setor (Opcional) */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Unidade Escolar / Setor / Função (Opcional)
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    list="sesi-units-birthday-list"
                    value={unitInput}
                    onChange={(e) => setUnitInput(e.target.value)}
                    placeholder="Ex.: SESI Paulista · Secretaria Escolar"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-bold text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                  />
                  <datalist id="sesi-units-birthday-list">
                    {UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Mensagem de Parabéns */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Mensagem de Homenagem no Mural
                </label>
                <textarea
                  rows={2}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Mensagem curta de parabéns para exibir na TV..."
                  className="w-full px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                />
              </div>

              {formError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold border-2 border-b-4 border-sky-700 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {editingMemberId ? 'Salvar Alterações' : 'Adicionar ao Mural'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
