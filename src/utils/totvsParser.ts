import { TotvsStudentRow, TOTVS_FIELDS } from '../types/totvs';

/**
 * Normaliza cada linha vinda da consulta SQL do TOTVS RM, removendo espaços
 * em branco excedentes (ex: "16/10/2017                    ") e garantindo _id único.
 */
export function normalizeTotvsRow(raw: Record<string, unknown>, index: number): TotvsStudentRow {
  const cleaned: Record<string, unknown> = {};

  // Garante que todas as 57 chaves do schema existam no objeto
  for (const field of TOTVS_FIELDS) {
    cleaned[field.key] = null;
  }

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      cleaned[key] = value.trim();
    } else {
      cleaned[key] = value;
    }
  }

  const ra = cleaned['RA'] ? String(cleaned['RA']) : `novo-${index}`;
  const periodo = cleaned['PERIODO'] ? String(cleaned['PERIODO']) : '2027';
  cleaned._id = (raw._id as string) || `row-${ra}-${periodo}-${index}-${Date.now()}`;
  cleaned._modified = Boolean(raw._modified);
  cleaned._modifiedFields = Array.isArray(raw._modifiedFields) ? raw._modifiedFields : [];

  return cleaned as TotvsStudentRow;
}

/**
 * Faz o parse de um JSON do TOTVS RM ({ "Row": [...] } ou [...]),
 * incluindo recuperação inteligente caso o JSON colado esteja truncado no final.
 */
export function parseTotvsJsonInput(rawInput: string): {
  rows: TotvsStudentRow[];
  repaired: boolean;
  error?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { rows: [], repaired: false, error: 'O conteúdo JSON está vazio.' };
  }

  const extractRows = (parsed: unknown): Record<string, unknown>[] | null => {
    if (Array.isArray(parsed)) {
      return parsed as Record<string, unknown>[];
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.Row)) return obj.Row as Record<string, unknown>[];
      if (Array.isArray(obj.row)) return obj.row as Record<string, unknown>[];
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
      // Caso seja um único objeto de linha colado diretamente
      if ('UNIDADE' in obj || 'RA' in obj || 'ALUNO' in obj || 'PERIODO' in obj) {
        return [obj];
      }
    }
    return null;
  };

  // Tentativa 1: JSON válido completo
  try {
    const parsed = JSON.parse(trimmed);
    const extracted = extractRows(parsed);
    if (extracted) {
      return {
        rows: extracted.map((r, i) => normalizeTotvsRow(r, i)),
        repaired: false,
      };
    }
  } catch {
    // Continua para tentativa de reparo de JSON truncado
  }

  // Tentativa 2: Reparo de JSON truncado (ex: termina com "}," ou "}" sem fechar "] }")
  const candidates = [
    trimmed.replace(/,\s*$/, '') + ']}',
    trimmed.replace(/,\s*$/, '') + ']',
    trimmed.replace(/,\s*$/, '') + '}',
    trimmed.replace(/,\s*$/, '') + '"}]}',
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const extracted = extractRows(parsed);
      if (extracted && extracted.length > 0) {
        return {
          rows: extracted.map((r, i) => normalizeTotvsRow(r, i)),
          repaired: true,
        };
      }
    } catch {
      // Tenta próximo candidato
    }
  }

  return {
    rows: [],
    repaired: false,
    error: 'Formato JSON inválido. Certifique-se de colar a estrutura { "Row": [ { ... } ] } retornada pelo TOTVS RM.',
  };
}

/**
 * Exporta as linhas de volta para o formato padrão TOTVS RM { "Row": [...] }
 * removendo metadados internos (_id, _modified, _modifiedFields).
 */
export function formatToTotvsJson(rows: TotvsStudentRow[]): string {
  const cleanRows = rows.map((row) => {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith('_')) {
        copy[key] = value;
      }
    }
    return copy;
  });

  return JSON.stringify({ Row: cleanRows }, null, 4);
}

/**
 * Exporta as linhas para CSV separado por ponto-e-vírgula (compatível com Excel PT-BR)
 */
export function formatToCsv(rows: TotvsStudentRow[], visibleKeys?: string[]): string {
  const keys =
    visibleKeys && visibleKeys.length > 0
      ? visibleKeys
      : TOTVS_FIELDS.map((f) => f.key as string);

  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const header = keys.map((k) => `"${k}"`).join(';');
  const lines = rows.map((row) =>
    keys.map((k) => escapeCsvCell(row[k])).join(';')
  );

  return '\uFEFF' + [header, ...lines].join('\r\n');
}
