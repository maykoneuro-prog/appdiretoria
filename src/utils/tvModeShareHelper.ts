import { UnitProgressMetrics } from '../data/sesiGoals2027';

export function getPublicTvShareUrl(): string {
  try {
    const url = new URL(window.location.href);
    // Substitui o host de desenvolvimento privado (ais-dev-) pelo host compartilhado (ais-pre-)
    url.hostname = url.hostname.replace(/^ais-dev-/i, 'ais-pre-');
    url.searchParams.set('tv', '1');
    url.hash = '';
    return url.toString();
  } catch {
    return window.location.origin.replace('//ais-dev-', '//ais-pre-') + '/?tv=1';
  }
}

export function buildStandaloneTvHtml(params: {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaPagasTotal: number;
    realTotal: number;
    realPagasTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
    metaDiariaPagasAte31Dez: number;
    mediaPorDiaAtivo: number;
  };
  turmaCapacities: Record<string, number>;
}): string {
  const { units, totals, turmaCapacities } = params;
  const nowStr = new Date().toLocaleString('pt-BR');
  const publicApiOrigin = window.location.origin.replace('//ais-dev-', '//ais-pre-');

  const ranked = [...units].sort(
    (a, b) => b.pctGeral - a.pctGeral || b.realTotal - a.realTotal
  );

  const cardsHtml = ranked
    .map((u, idx) => {
      const activeTurmas = u.turmas.filter(
        (t) => t.ocupacaoComReservada > 0 || (turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0) > 0
      );
      const ocup = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
      const cap = activeTurmas.reduce(
        (acc, t) => acc + (turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0),
        0
      );
      const pctSala = cap > 0 ? ((ocup / cap) * 100).toFixed(1) : '0.0';
      const medal = idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`;

      return `
        <div class="card">
          <div class="card-head">
            <div>
              <span class="badge-rank">${medal}</span>
              <span class="unit-title">SESI ${u.goal.shortName}</span>
            </div>
            <div class="pct-pill">${u.pctGeral.toFixed(1)}%</div>
          </div>
          <div class="main-num">
            <strong>${u.realTotal.toLocaleString('pt-BR')}</strong>
            <span>/ ${u.goal.metaGeral.toLocaleString('pt-BR')} matrículas (Faltam ${u.faltamParaMeta})</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" style="width:${Math.min(100, Math.max(3, u.pctGeral))}%"></div>
          </div>
          <div class="sub-grid">
            <div class="sub-box">
              <div class="sub-lbl">PAGAS (VET+NOV)</div>
              <div class="sub-val">${u.realPagasTotal}/${u.metaPagasTotal} (${u.pctPagasTotal.toFixed(0)}%)</div>
            </div>
            <div class="sub-box">
              <div class="sub-lbl">GRATUIDADES</div>
              <div class="sub-val">${u.realGratuidadeRemanescente + u.realNovasGratuidade}/${u.goal.gratuidadeRemanescente + u.goal.novasVagasGratuidade2027}</div>
            </div>
            <div class="sub-box">
              <div class="sub-lbl">OCUPAÇÃO SALA</div>
              <div class="sub-val">${ocup}/${cap || '—'} (${pctSala}%)</div>
            </div>
            <div class="sub-box">
              <div class="sub-lbl">RESERVADA / PORTAL</div>
              <div class="sub-val">${u.vetReservada} res · ${u.renovacaoPortalCount} portal</div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Modo TV Escolar — Matrículas SESI-PE 2027 (Público / Sem Dados Sensíveis)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f0f7ff;
      color: #0f172a;
      padding: 14px 18px;
    }
    .header {
      background: linear-gradient(135deg, #0077b6 0%, #009fe3 100%);
      color: #fff;
      border-radius: 16px;
      padding: 14px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0, 159, 227, 0.2);
    }
    .header h1 { font-size: 20px; font-weight: 800; }
    .header .sub { font-size: 11px; opacity: 0.92; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
    .kpis { display: flex; gap: 14px; flex-wrap: wrap; }
    .kpi {
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 12px;
      padding: 8px 14px;
      text-align: center;
    }
    .kpi-lbl { font-size: 10px; text-transform: uppercase; font-weight: 700; opacity: 0.9; }
    .kpi-val { font-size: 20px; font-weight: 800; font-family: monospace; }
    .scale-bar {
      background: #fff;
      border: 2px solid #bae6fd;
      border-radius: 14px;
      padding: 10px 16px;
      margin-bottom: 12px;
    }
    .scale-top { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 6px; color: #0369a1; }
    .progress-track { width: 100%; height: 10px; background: #e0f2fe; border-radius: 99px; overflow: hidden; margin: 6px 0; }
    .progress-bar { height: 100%; background: linear-gradient(90deg, #009fe3, #10b981); border-radius: 99px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 10px;
    }
    .card {
      background: #fff;
      border: 2px solid #bae6fd;
      border-bottom-width: 5px;
      border-radius: 16px;
      padding: 12px 14px;
    }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .badge-rank { font-size: 11px; font-weight: 800; background: #f1f5f9; padding: 2px 7px; border-radius: 6px; margin-right: 6px; }
    .unit-title { font-size: 15px; font-weight: 800; color: #0f172a; }
    .pct-pill { font-size: 13px; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 8px; font-family: monospace; }
    .main-num { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .main-num strong { font-size: 18px; color: #0f172a; font-family: monospace; }
    .sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
    .sub-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; }
    .sub-lbl { font-size: 9px; font-weight: 800; color: #64748b; }
    .sub-val { font-size: 11px; font-weight: 800; color: #0f172a; font-family: monospace; margin-top: 1px; }
    .footer { margin-top: 10px; text-align: center; font-size: 11px; color: #64748b; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="sub">Rede SESI Educação de Pernambuco · Modo TV Escolar (Sem Dados Sensíveis)</div>
      <h1>Mural Escolar & Campanha de Matrículas 2027</h1>
    </div>
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-lbl">Matriculados + Pré</div>
        <div class="kpi-val">${totals.realTotal.toLocaleString('pt-BR')}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Meta Escala Pagas</div>
        <div class="kpi-val">${totals.metaPagasTotal.toLocaleString('pt-BR')}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Meta Geral Rede</div>
        <div class="kpi-val">${totals.metaGeral.toLocaleString('pt-BR')}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">% Atingimento</div>
        <div class="kpi-val">${totals.pctPagasTotal.toFixed(1)}%</div>
      </div>
    </div>
  </div>

  <div class="scale-bar">
    <div class="scale-top">
      <span>ESCALA DE MATRÍCULAS (08/SET A 31/DEZ): ${totals.realTotal.toLocaleString('pt-BR')} DE ${totals.metaPagasTotal.toLocaleString('pt-BR')} ALUNOS</span>
      <span>Faltam ${totals.faltamPagasParaMeta.toLocaleString('pt-BR')} (${totals.metaDiariaPagasAte31Dez.toFixed(1)}/dia até 31/12) · Atualizado: ${nowStr}</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" style="width:${Math.min(100, Math.max(2, totals.pctPagasTotal))}%"></div>
    </div>
  </div>

  <div class="grid">
    ${cardsHtml}
  </div>

  <div class="footer">
    Painel Modo TV Escolar SESI-PE 2027 · Visualização 100% pública (apenas indicadores agregados por unidade, sem dados pessoais de alunos).
  </div>
  <script>
    // Tenta atualizar silenciosamente a cada 5 minutos se houver conexão
    setTimeout(function() {
      fetch("${publicApiOrigin}/api/tv-public-data")
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d && d.ok) window.location.reload(); })
        .catch(function() {});
    }, 300000);
  </script>
</body>
</html>`;
}

export function downloadStandaloneTvHtml(params: {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaPagasTotal: number;
    realTotal: number;
    realPagasTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
    metaDiariaPagasAte31Dez: number;
    mediaPorDiaAtivo: number;
  };
  turmaCapacities: Record<string, number>;
}): string {
  const html = buildStandaloneTvHtml(params);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = 'Modo_TV_Escolar_SESI_PE_2027.html';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}
