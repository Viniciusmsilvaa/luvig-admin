import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import officialLogo from '../assets/luvig-logo-oficial.png';
import { currencyBRL, shortDate } from '../utils/formatters.js';
import { formatTenure } from '../utils/employeeDates.js';
import { getFriendlyError } from './serviceHelpers.js';

export const reportLabels = {
  employees: 'Funcionários', occurrences: 'Ocorrências', scores: 'Notas', vacations: 'Férias',
  medical: 'Atestados', clients: 'Clientes', financial: 'Financeiro',
};

const statusLabels = {
  ativo: 'Ativo', ferias: 'Férias', atestado: 'Atestado', aviso_previo: 'Aviso prévio', inativo: 'Inativo', desligado: 'Desligado',
  aguardando_conferencia: 'Aguardando conferência', recomendado_pelo_rh: 'Recomendado pelo RH', confirmado: 'Confirmado', recusado: 'Recusado',
  pendente: 'Pendente', em_analise: 'Em análise', aprovado: 'Aprovado', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado',
  suspenso: 'Suspenso', encerrado: 'Encerrado',
};

const typeLabels = {
  falta: 'Falta', atraso: 'Atraso', atestado: 'Atestado', advertencia: 'Advertência', suspensao: 'Suspensão', elogio: 'Elogio',
  deslize: 'Deslize', hora_extra: 'Hora extra', hora_faltante: 'Hora faltante', ferias: 'Férias', aviso_previo: 'Aviso prévio',
  demissao: 'Demissão', observacao: 'Observação', predio_sujo: 'Prédio sujo', servico_nao_realizado: 'Serviço não realizado',
  reclamacao_sindico: 'Reclamação do síndico', solicitacao_sindico: 'Solicitação do síndico', problema_condominio: 'Problema em condomínio',
  pedido_material: 'Pedido de material', ocorrencia_geral: 'Ocorrência geral',
};

const label = (map, value) => map[value] || value || 'Não informado';
const within = (value, from, to) => (!from || value >= from) && (!to || value <= to);

async function queryOrThrow(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}

export async function getReportOptions({ role } = {}) {
  if (!supabase || !isSupabaseConfigured) return { data: { employees: [], clients: [] }, error: 'Erro ao gerar relatório.' };
  try {
    const [employees, clients] = await Promise.all([
      queryOrThrow(supabase.from('employees').select('id, full_name, role').order('full_name')),
      queryOrThrow(supabase.from('clients').select('id, name').order('name')),
    ]);
    return {
      data: {
        employees: employees.map((item) => ({ id: item.id, name: item.full_name, role: item.role || '' })),
        clients: role === 'Admin' || role === 'RH' ? clients : [],
      },
      error: null,
    };
  } catch (error) {
    return { data: { employees: [], clients: [] }, error: getFriendlyError(error, 'Erro ao gerar relatório.') };
  }
}

export async function getReport(type, filters = {}, role = 'RH') {
  if (!supabase || !isSupabaseConfigured) return { data: [], chart: [], error: 'Erro ao gerar relatório.' };
  if (type === 'financial' && role !== 'Admin') return { data: [], chart: [], error: 'Sem permissão para visualizar o relatório financeiro.' };

  try {
    if (type === 'medical') {
      let query = supabase
        .from('occurrences')
        .select('id, occurrence_date, status, employee_id, employees(full_name, medical_leave_return_date, role)')
        .eq('type', 'atestado')
        .order('occurrence_date', { ascending: false });
      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('occurrence_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('occurrence_date', filters.dateTo);
      const rows = await queryOrThrow(query);
      return {
        data: rows.filter((item) => !filters.role || item.employees?.role === filters.role).map((item) => ({ name: item.employees?.full_name || 'Sem vínculo', date: shortDate(item.occurrence_date), returnDate: shortDate(item.employees?.medical_leave_return_date) })),
        chart: [], error: null,
      };
    }

    if (['employees', 'scores', 'vacations'].includes(type)) {
      const employees = await queryOrThrow(supabase.from('employees').select('id, full_name, role, score, status, admission_date, next_vacation_date, vacation_return_date, medical_leave_return_date').order('full_name'));
      let rows = employees.filter((item) => (!filters.employeeId || item.id === filters.employeeId) && (!filters.status || item.status === filters.status) && (!filters.role || item.role === filters.role));
      if (type === 'employees') rows = rows.filter((item) => within(item.admission_date, filters.dateFrom, filters.dateTo));
      if (type === 'vacations') rows = rows.filter((item) => item.status === 'ferias' || item.next_vacation_date || item.vacation_return_date).filter((item) => within(item.next_vacation_date || item.vacation_return_date, filters.dateFrom, filters.dateTo));

      if (type === 'scores') {
        rows.sort((a, b) => Number(b.score) - Number(a.score));
        const history = await queryOrThrow(supabase.from('employee_history').select('employee_id, history_date, occurrences(score_impact, status)').order('history_date'));
        const monthly = new Map();
        history.filter((item) => item.occurrences?.status === 'confirmado' && within(item.history_date, filters.dateFrom, filters.dateTo)).forEach((item) => {
          const key = item.history_date?.slice(0, 7);
          if (key) monthly.set(key, (monthly.get(key) || 0) + Number(item.occurrences?.score_impact || 0));
        });
        return {
          data: rows.map((item, index) => ({ ranking: index + 1, name: item.full_name, role: item.role || 'Não informada', score: Number(item.score || 0), attention: Number(item.score || 0) < 5 ? 'Atenção' : 'Regular' })),
          chart: [...monthly].slice(-12).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
          error: null,
        };
      }

      if (type === 'vacations') return { data: rows.map((item) => ({ name: item.full_name, status: label(statusLabels, item.status), nextVacation: shortDate(item.next_vacation_date), returnDate: shortDate(item.vacation_return_date) })), chart: [], error: null };

      const chartCounts = rows.reduce((acc, item) => ({ ...acc, [label(statusLabels, item.status)]: (acc[label(statusLabels, item.status)] || 0) + 1 }), {});
      return {
        data: rows.map((item) => ({ name: item.full_name, role: item.role || 'Não informada', score: Number(item.score || 0), status: label(statusLabels, item.status), tenure: formatTenure(item.admission_date) })),
        chart: Object.entries(chartCounts).map(([name, value]) => ({ name, value })), error: null,
      };
    }

    if (type === 'occurrences') {
      let query = supabase.from('occurrences').select('id, type, occurrence_date, status, employee_id, created_by_profile:profiles!occurrences_created_by_fkey(full_name), employees(full_name)').order('occurrence_date', { ascending: false });
      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.dateFrom) query = query.gte('occurrence_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('occurrence_date', filters.dateTo);
      const rows = await queryOrThrow(query);
      const monthly = rows.reduce((acc, item) => ({ ...acc, [item.occurrence_date?.slice(0, 7)]: (acc[item.occurrence_date?.slice(0, 7)] || 0) + 1 }), {});
      return {
        data: rows.map((item) => ({ type: label(typeLabels, item.type), employee: item.employees?.full_name || 'Sem vínculo', date: shortDate(item.occurrence_date), status: label(statusLabels, item.status), responsible: item.created_by_profile?.full_name || 'Não informado' })),
        chart: Object.entries(monthly).sort().slice(-12).map(([name, value]) => ({ name, value })), error: null,
      };
    }

    if (type === 'clients') {
      const rows = (await queryOrThrow(supabase.rpc('list_clients_secure', { target_client_id: filters.clientId || null })))
        .filter((item) => (!filters.status || item.status === filters.status) && within(item.created_at?.slice(0, 10), filters.dateFrom, filters.dateTo));
      return { data: rows.map((item) => ({ condominium: item.name, responsible: item.responsible_name || 'Não informado', monthlyValue: role === 'Admin' ? currencyBRL(item.monthly_value) : 'Restrito ao Admin', services: (item.contracted_services || []).join(', ') || 'Não informado', status: label(statusLabels, item.status) })), chart: [], error: null };
    }

    if (type === 'financial') {
      let entriesQuery = supabase.from('financial_entries').select('id, title, amount, status, paid_date, due_date, clients(name)').order('due_date', { ascending: false });
      let expensesQuery = supabase.from('financial_expenses').select('id, title, amount, status, expense_date').order('expense_date', { ascending: false });
      if (filters.clientId) entriesQuery = entriesQuery.eq('client_id', filters.clientId);
      if (filters.status) { entriesQuery = entriesQuery.eq('status', filters.status); expensesQuery = expensesQuery.eq('status', filters.status); }
      if (filters.dateFrom) { entriesQuery = entriesQuery.gte('due_date', filters.dateFrom); expensesQuery = expensesQuery.gte('expense_date', filters.dateFrom); }
      if (filters.dateTo) { entriesQuery = entriesQuery.lte('due_date', filters.dateTo); expensesQuery = expensesQuery.lte('expense_date', filters.dateTo); }
      const [entries, expenses] = await Promise.all([queryOrThrow(entriesQuery), queryOrThrow(expensesQuery)]);
      const monthly = new Map();
      entries.forEach((item) => { const key = (item.paid_date || item.due_date)?.slice(0, 7); if (key) monthly.set(key, { name: key, entries: (monthly.get(key)?.entries || 0) + Number(item.amount), expenses: monthly.get(key)?.expenses || 0 }); });
      expenses.forEach((item) => { const key = item.expense_date?.slice(0, 7); if (key) monthly.set(key, { name: key, entries: monthly.get(key)?.entries || 0, expenses: (monthly.get(key)?.expenses || 0) + Number(item.amount) }); });
      const data = [
        ...entries.map((item) => ({ movement: 'Entrada', description: item.title, client: item.clients?.name || '—', date: shortDate(item.paid_date || item.due_date), status: label(statusLabels, item.status), value: currencyBRL(item.amount) })),
        ...expenses.map((item) => ({ movement: 'Saída', description: item.title, client: '—', date: shortDate(item.expense_date), status: label(statusLabels, item.status), value: currencyBRL(item.amount) })),
      ];
      const entriesTotal = entries.filter((item) => item.status === 'pago').reduce((total, item) => total + Number(item.amount || 0), 0);
      const expensesTotal = expenses.filter((item) => item.status === 'pago').reduce((total, item) => total + Number(item.amount || 0), 0);
      const pendingClients = new Set(entries.filter((item) => ['pendente', 'atrasado'].includes(item.status)).map((item) => item.clients?.name).filter(Boolean)).size;
      return { data, chart: [...monthly.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(-12), summary: { entriesTotal, expensesTotal, balance: entriesTotal - expensesTotal, pendingClients }, error: null };
    }

    return { data: [], chart: [], error: null };
  } catch (error) {
    return { data: [], chart: [], error: getFriendlyError(error, 'Erro ao gerar relatório.') };
  }
}

function columnTitle(key) {
  const titles = { ranking: '#', name: 'Nome', role: 'Função', score: 'Nota', attention: 'Situação', status: 'Status', tenure: 'Tempo de casa', type: 'Tipo', employee: 'Funcionário', date: 'Data', responsible: 'Responsável', nextVacation: 'Próximas férias', returnDate: 'Retorno previsto', condominium: 'Condomínio', monthlyValue: 'Valor mensal', services: 'Serviços contratados', movement: 'Movimento', description: 'Descrição', client: 'Cliente', value: 'Valor' };
  return titles[key] || key;
}

function safeFilename(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

let cachedLogoDataUrl = '';

async function loadOfficialLogo() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const response = await fetch(officialLogo);
    const blob = await response.blob();
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    return '';
  }
}

function drawPdfHeader(doc, title, generatedAt, logoDataUrl) {
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 10, 2, 34, 28, undefined, 'FAST');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, 48, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${generatedAt.toLocaleDateString('pt-BR')}`, doc.internal.pageSize.getWidth() - 14, 16, { align: 'right' });
}

export async function exportReportPdf({ type, rows }) {
  if (!rows?.length) throw new Error('Sem dados para exibir.');
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const title = `Relatório de ${reportLabels[type] || type}`;
  const keys = Object.keys(rows[0]);
  const doc = new jsPDF({ orientation: keys.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const generatedAt = new Date();
  const logoDataUrl = await loadOfficialLogo();
  drawPdfHeader(doc, title, generatedAt, logoDataUrl);
  autoTable(doc, {
    startY: 28,
    head: [keys.map(columnTitle)],
    body: rows.map((row) => keys.map((key) => String(row[key] ?? '—'))),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.4, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [22, 87, 196], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      const height = doc.internal.pageSize.getHeight();
      if (page > 1) drawPdfHeader(doc, title, generatedAt, logoDataUrl);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Página ${page}`, 14, height - 8);
      doc.text(generatedAt.toLocaleString('pt-BR'), doc.internal.pageSize.getWidth() - 14, height - 8, { align: 'right' });
    },
    margin: { top: 28, bottom: 16 },
  });
  doc.save(`${safeFilename(title)}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}

function excelColumn(index) {
  let value = '';
  let current = index;
  while (current > 0) {
    current -= 1;
    value = String.fromCharCode(65 + (current % 26)) + value;
    current = Math.floor(current / 26);
  }
  return value;
}

function escapeXml(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function exportReportExcel({ type, rows }) {
  if (!rows?.length) throw new Error('Sem dados para exibir.');
  const { strToU8, zipSync } = await import('fflate');
  const title = `Relatório de ${reportLabels[type] || type}`;
  const keys = Object.keys(rows[0]);
  const header = keys.map(columnTitle);
  const lastColumn = excelColumn(keys.length);
  const rowXml = (values, rowNumber, style) => `<row r="${rowNumber}"${rowNumber === 1 ? ' ht="28" customHeight="1"' : ''}>${values.map((value, index) => `<c r="${excelColumn(index + 1)}${rowNumber}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value ?? '—')}</t></is></c>`).join('')}</row>`;
  const widths = keys.map((key) => Math.min(48, Math.max(columnTitle(key).length + 3, ...rows.map((row) => String(row[key] ?? '').length + 2))));
  const sheetRows = [
    rowXml([`LUVIG — ${title}`], 1, 1),
    rowXml([`Gerado em ${new Date().toLocaleString('pt-BR')}`], 2, 2),
    '<row r="3"/>', rowXml(header, 4, 3),
    ...rows.map((row, index) => rowXml(keys.map((key) => row[key]), index + 5, index % 2 ? 5 : 4)),
  ].join('');
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(reportLabels[type] || 'Relatório')}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Arial"/><color rgb="FF1E293B"/></font><font><b/><sz val="16"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><i/><sz val="10"/><name val="Arial"/><color rgb="FF64748B"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1657C4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><autoFilter ref="A4:${lastColumn}${rows.length + 4}"/></worksheet>`,
  };
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)])), { level: 6 });
  const blob = new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(title)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function subscribeReports({ role, onChange } = {}) {
  if (!supabase || typeof onChange !== 'function') return () => {};
  const tables = role === 'Admin' ? ['employees', 'occurrences', 'clients', 'financial_entries', 'financial_expenses', 'employee_history'] : ['employees', 'occurrences', 'clients', 'employee_history'];
  let timer;
  const channel = supabase.channel(`reports-${role}-${Date.now()}`);
  tables.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 300);
  }));
  channel.subscribe();
  return () => { window.clearTimeout(timer); supabase.removeChannel(channel); };
}
