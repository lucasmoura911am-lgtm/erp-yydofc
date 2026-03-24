import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  const { contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();

  if (!contract_id || !company_id) {
    return Response.json({ error: 'contract_id e company_id são obrigatórios' }, { status: 400 });
  }

  const results = {
    risks_created: 0,
    actions_created: 0,
    health_plans_created: 0,
    non_conformities_created: 0,
    employees_linked: 0,
    errors: []
  };

  const today = new Date();
  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split('T')[0];
  };

  // ─── VALORES VÁLIDOS ────────────────────────────────────────────────────────
  const VALID_RISK_TYPES = ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'];
  const VALID_LEVELS     = ['baixo', 'medio', 'alto', 'critico'];
  const VALID_PROB       = ['baixa', 'media', 'alta'];
  const VALID_SEV        = ['leve', 'moderada', 'grave', 'gravissima'];
  const VALID_PRIO       = ['baixa', 'media', 'alta', 'urgente'];
  const VALID_ACT        = ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica', 'retorno'];
  const VALID_FREQ       = ['unico', 'mensal', 'trimestral', 'semestral', 'anual', 'continuo'];
  const VALID_CAT        = ['exame', 'epi', 'treinamento', 'inspecao', 'monitoramento', 'outro'];

  const norm = (val, list, def) => {
    const v = (val || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z_]/g, '').trim();
    return list.includes(v) ? v : def;
  };

  // ─── FIX 1: fetch do PDF → base64 ─────────────────────────────────────────
  // Substituímos ExtractDataFromUploadedFile (que falha em PDFs complexos)
  // por um fetch direto que converte para base64 e passa ao LLM nativamente.
  const pdfToBase64 = async (url, label) => {
    try {
      console.log(`[${label}] Baixando PDF de: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      // Converte para base64 em chunks para evitar stack overflow
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      console.log(`[${label}] PDF convertido: ${(uint8Array.length / 1024).toFixed(0)}KB → ${base64.length} chars base64`);
      return base64;
    } catch (e) {
      console.error(`[${label}] Erro ao baixar PDF:`, e.message);
      return null;
    }
  };

  // ─── SCHEMA JSON para o LLM ────────────────────────────────────────────────
  const BASE_SCHEMA = {
    type: 'object',
    properties: {
      empresa: { type: 'string' },
      setores: { type: 'array', items: { type: 'string' } },
      riscos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            setor: { type: 'string' },
            cargo: { type: 'string' },
            tipo: { type: 'string' },
            descricao: { type: 'string' },
            nivel_risco: { type: 'string' },
            probabilidade: { type: 'string' },
            severidade: { type: 'string' },
            medidas_controle: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      acoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            risco_id: { type: 'string' },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            tipo: { type: 'string' },
            setor: { type: 'string' },
            cargo: { type: 'string' },
            frequencia: { type: 'string' },
            prioridade: { type: 'string' },
            prazo_dias: { type: 'number' },
            obrigacao_legal: { type: 'boolean' },
            consequencia_nao_execucao: { type: 'string' },
            activity_type: { type: 'string' },
            esocial_code: { type: 'string' }
          }
        }
      },
      tarefas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            acao_id: { type: 'string' },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            setor: { type: 'string' },
            cargo: { type: 'string' },
            periodicidade: { type: 'string' },
            obrigatoria: { type: 'boolean' }
          }
        }
      },
      nao_conformidades: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string' },
            gravidade: { type: 'string' },
            acao_corretiva: { type: 'string' },
            prazo_dias: { type: 'number' }
          }
        }
      }
    }
  };

  // ─── FIX 2: InvokeLLM com PDF em base64 ───────────────────────────────────
  // Usamos o campo "messages" com document block (base64) em vez de file_urls,
  // garantindo que o LLM receba e leia o conteúdo completo do PDF.
  const invokeLLMWithPDF = async (pdfBase64, tipoDoc, instrucoes) => {
    const systemPrompt = `Você é um engenheiro de segurança do trabalho especialista em NR-01, PGR e PCMSO.
Sua função é transformar o documento em EXECUÇÃO OPERACIONAL dentro de um sistema ERP.

🚨 REGRAS OBRIGATÓRIAS:
- Para CADA risco identificado → gerar pelo menos 1 ação e 1 tarefa
- NÃO pode existir risco sem ação, NÃO pode existir ação sem tarefa
- Extraia TODOS os riscos do documento, não apenas os óbvios
- Extraia TODOS os exames e atividades de saúde com periodicidade

📌 REGRAS DE NEGÓCIO (aplique automaticamente):
SE risco = ruído/vibração  → ação: audiometria + protetor auricular (EPI)
SE risco = químico         → ação: controle de exposição + EPI específico
SE risco = biológico       → ação: vacinação + monitoramento saúde
SE risco = ergonômico      → ação: avaliação ergonômica + ginástica laboral
SE risco = acidente        → ação: inspeção periódica + treinamento NR-35/NR-06

📌 CAMPOS OBRIGATÓRIOS — use EXATAMENTE estes valores (sem acentos, sem espaços):
- riscos[].tipo: fisico | quimico | biologico | ergonomico | acidente
- riscos[].nivel_risco: baixo | medio | alto | critico
- riscos[].probabilidade: baixa | media | alta
- riscos[].severidade: leve | moderada | grave | gravissima
- acoes[].tipo: exame | epi | treinamento | inspecao | monitoramento | outro
- acoes[].prioridade: baixa | media | alta | urgente
- acoes[].frequencia: unico | mensal | trimestral | semestral | anual | continuo
- tarefas[].periodicidade: unico | mensal | trimestral | semestral | anual | continuo

Responda APENAS com JSON válido. Sem texto fora do JSON. Sem markdown.`;

    const userMessage = `Tipo de documento: ${tipoDoc}
${instrucoes}

Leia o documento PDF anexado e extraia TODAS as informações conforme as regras acima.
Retorne apenas o JSON estruturado.`;

    // FIX: usa messages com document block em base64
    const payload = {
      model: 'claude_sonnet_4_6',
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: userMessage
            }
          ]
        }
      ],
      response_json_schema: BASE_SCHEMA
    };

    console.log('[LLM] Enviando payload com PDF base64...');
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(payload);
    console.log('[LLM] Resposta recebida:', JSON.stringify(result).slice(0, 300));
    return result;
  };

  // ─── FIX 3: Busca employees/departments (não bloqueia se falhar) ───────────
  let employees = [], departments = [];
  try {
    [employees, departments] = await Promise.all([
      base44.asServiceRole.entities.Employee.filter({ company_id }),
      base44.asServiceRole.entities.Department.filter({ company_id }),
    ]);
  } catch (e) {
    results.errors.push('Aviso vínculos: ' + e.message);
  }

  const findDept = (nomeSetor) => {
    if (!nomeSetor) return null;
    const s = nomeSetor.toLowerCase();
    return departments.find(d => d.name?.toLowerCase().includes(s.slice(0, 6)));
  };

  const linkEmployees = async (setor, prazo, descricao) => {
    const dept = findDept(setor);
    if (!dept?.id || !employees.length) return;
    for (const emp of employees.filter(e => e.department_id === dept.id).slice(0, 30)) {
      try {
        await base44.asServiceRole.entities.EmployeeSafetyActivity.create({
          employee_id: emp.id, company_id, contract_id,
          status: 'pendente', scheduled_date: prazo, observations: descricao,
        });
        results.employees_linked++;
      } catch {}
    }
  };

  // ─── FIX 4: persistResult com contract_id em TODOS os registros ───────────
  const persistResult = async (rawResult, isPCMSO) => {
    const result = rawResult?.response || rawResult || {};
    const riscos = result?.riscos || [];
    const acoes  = result?.acoes  || [];
    const tarefas = result?.tarefas || [];
    const riskIdMap = {};

    console.log(`[PERSIST] ${riscos.length} riscos | ${acoes.length} ações | ${tarefas.length} tarefas`);

    // 1. Salva riscos
    for (const risco of riscos) {
      if (!risco.descricao && !risco.tipo) continue;
      try {
        const created = await base44.asServiceRole.entities.RiskInventory.create({
          contract_id,          // FIX: sempre incluir
          company_id,
          department_id: findDept(risco.setor)?.id || '',
          risk_name: risco.descricao || `${risco.tipo} — ${risco.setor || ''}`,
          risk_type: norm(risco.tipo, VALID_RISK_TYPES, 'acidente'),
          risk_description: risco.descricao || '',
          risk_level: norm(risco.nivel_risco, VALID_LEVELS, 'medio'),
          probability: norm(risco.probabilidade, VALID_PROB, 'media'),
          severity: norm(risco.severidade, VALID_SEV, 'moderada'),
          control_measures: Array.isArray(risco.medidas_controle)
            ? risco.medidas_controle.join('; ')
            : (risco.medidas_controle || ''),
          active: true,
          source: isPCMSO ? 'pcmso_upload' : 'pgr_upload',
        });
        results.risks_created++;
        if (risco.id) riskIdMap[risco.id] = created.id;
      } catch (e) {
        console.error('[PERSIST] Erro ao salvar risco:', e.message);
        results.errors.push(`Risco "${risco.descricao?.slice(0,40)}": ${e.message}`);
      }
    }

    // 2. Salva ações
    const acaoIdMap = {};
    for (const acao of acoes) {
      if (!acao.titulo && !acao.descricao) continue;
      try {
        const priority  = norm(acao.prioridade, VALID_PRIO, 'media');
        const prazo     = addDays(today, Number(acao.prazo_dias) || (isPCMSO ? 365 : 90));
        const realRiskId = (acao.risco_id && riskIdMap[acao.risco_id]) || '';
        const prefix     = isPCMSO ? '[PCMSO] ' : '[PGR] ';

        // FIX: adiciona contract_id que estava faltando
        const created = await base44.asServiceRole.entities.RiskActionPlan.create({
          contract_id,           // FIX: essencial para filtro por contrato
          company_id,
          risk_id: realRiskId,
          action_description: prefix + (acao.titulo || acao.descricao),
          responsible: responsible || (isPCMSO ? 'Médico do Trabalho' : 'Responsável SST'),
          deadline: prazo,
          status: 'pendente',
          priority,
          notes: [
            acao.descricao,
            acao.consequencia_nao_execucao ? `Consequência: ${acao.consequencia_nao_execucao}` : '',
            acao.setor ? `Setor: ${acao.setor}` : '',
            acao.cargo ? `Cargo: ${acao.cargo}` : '',
          ].filter(Boolean).join('\n'),
          category: norm(acao.tipo, VALID_CAT, 'outro'),
          legal_obligation: acao.obrigacao_legal !== false,
          source: isPCMSO ? 'pcmso_upload' : 'pgr_upload',
        });
        results.actions_created++;
        if (acao.id) acaoIdMap[acao.id] = created.id;

        // HealthActivityPlan para exames e atividades PCMSO
        if (isPCMSO || norm(acao.tipo, VALID_CAT, '') === 'exame') {
          const actType   = norm(acao.activity_type, VALID_ACT, 'periodico');
          const frequency = norm(acao.frequencia, VALID_FREQ, 'anual');
          await base44.asServiceRole.entities.HealthActivityPlan.create({
            contract_id,         // FIX: contrato sempre presente
            company_id,
            activity_name: acao.titulo || acao.descricao,
            activity_type: actType,
            frequency,
            description: [
              acao.descricao,
              acao.setor ? `Setor: ${acao.setor}` : '',
              acao.cargo ? `Cargo: ${acao.cargo}` : '',
              acao.esocial_code ? `eSocial: ${acao.esocial_code}` : '',
            ].filter(Boolean).join(' | '),
            active: true,
            source: 'pcmso_upload',
          });
          results.health_plans_created++;
        }

        await linkEmployees(acao.setor, prazo, acao.titulo || acao.descricao);

      } catch (e) {
        console.error('[PERSIST] Erro ao salvar ação:', e.message);
        results.errors.push(`Ação "${acao.titulo?.slice(0,40)}": ${e.message}`);
      }
    }

    // 3. Salva tarefas como HealthActivityPlan
    for (const tarefa of tarefas) {
      if (!tarefa.titulo) continue;
      try {
        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id,           // FIX: contrato sempre presente
          company_id,
          activity_name: tarefa.titulo,
          activity_type: 'periodico',
          frequency: norm(tarefa.periodicidade, VALID_FREQ, 'anual'),
          description: [
            tarefa.descricao,
            tarefa.setor  ? `Setor: ${tarefa.setor}` : '',
            tarefa.cargo  ? `Cargo: ${tarefa.cargo}` : '',
          ].filter(Boolean).join(' | '),
          active: true,
          source: isPCMSO ? 'pcmso_upload' : 'pgr_upload',
        });
        results.health_plans_created++;
        await linkEmployees(tarefa.setor, addDays(today, 180), tarefa.titulo);
      } catch (e) {
        console.error('[PERSIST] Erro ao salvar tarefa:', e.message);
        results.errors.push(`Tarefa "${tarefa.titulo?.slice(0,40)}": ${e.message}`);
      }
    }

    // 4. Fallback: se nenhuma ação foi gerada, cria 1 por risco
    if (acoes.length === 0 && riscos.length > 0) {
      console.log('[PERSIST] Nenhuma ação gerada, aplicando fallback por risco...');
      for (const risco of riscos) {
        if (!risco.descricao && !risco.tipo) continue;
        try {
          const lvl      = norm(risco.nivel_risco, VALID_LEVELS, 'medio');
          const priority = lvl === 'critico' ? 'urgente' : lvl === 'alto' ? 'alta' : 'media';
          const prazo    = addDays(today, lvl === 'critico' ? 30 : lvl === 'alto' ? 60 : 90);
          await base44.asServiceRole.entities.RiskActionPlan.create({
            contract_id,         // FIX
            company_id,
            risk_id: (risco.id && riskIdMap[risco.id]) || '',
            action_description: `Controlar: ${risco.descricao || risco.tipo} — Setor: ${risco.setor || ''}`,
            responsible: responsible || 'Responsável SST',
            deadline: prazo,
            status: 'pendente',
            priority,
            notes: Array.isArray(risco.medidas_controle)
              ? risco.medidas_controle.join('; ')
              : '',
            legal_obligation: true,
            source: 'pgr_fallback',
          });
          results.actions_created++;
          await linkEmployees(risco.setor, prazo, risco.descricao || risco.tipo);
        } catch (e) {
          results.errors.push(`Fallback risco "${risco.descricao?.slice(0,30)}": ${e.message}`);
        }
      }
    }

    // 5. Não conformidades
    for (const nc of (result?.nao_conformidades || [])) {
      if (!nc.descricao) continue;
      try {
        const g = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          contract_id,           // FIX
          company_id,
          risk_id: '',
          action_description: `[NÃO CONFORMIDADE] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, Number(nc.prazo_dias) || 30),
          status: 'pendente',
          priority: g === 'alta' ? 'urgente' : 'alta',
          notes: nc.acao_corretiva || '',
          legal_obligation: true,
          source: 'nao_conformidade',
        });
        results.non_conformities_created++;
      } catch (e) {
        results.errors.push(`NC "${nc.descricao?.slice(0,40)}": ${e.message}`);
      }
    }
  };

  // ─── ANÁLISE DO PGR ─────────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      console.log('[PGR] Iniciando análise...');
      const pdfBase64 = await pdfToBase64(pgr_file_url, 'PGR');

      if (!pdfBase64) {
        results.errors.push('PGR: Não foi possível baixar o arquivo. Verifique a URL.');
      } else {
        const instrucoesPGR = `
📌 EXTRAÇÃO ESPECÍFICA PGR (NR-01):
- Identificar TODOS os riscos por setor e cargo com probabilidade e severidade
- Extrair medidas de controle existentes e as medidas propostas no plano de ação
- Identificar o plano de ação completo: cada linha do cronograma é uma ação
- Identificar não conformidades com prazos legais
- Criar plano de ação com prioridades baseadas no nível de risco
- Cada cargo tem seu próprio inventário de riscos — extraia todos os cargos`;

        const result = await invokeLLMWithPDF(pdfBase64, 'PGR — Programa de Gerenciamento de Riscos (NR-01)', instrucoesPGR);
        await persistResult(result, false);
      }
    } catch (err) {
      console.error('[PGR] Erro:', err.message);
      results.errors.push(`PGR: ${err.message}`);
    }
  }

  // ─── ANÁLISE DO PCMSO ───────────────────────────────────────────────────────
  if (pcmso_file_url) {
    try {
      console.log('[PCMSO] Iniciando análise...');
      const pdfBase64 = await pdfToBase64(pcmso_file_url, 'PCMSO');

      if (!pdfBase64) {
        results.errors.push('PCMSO: Não foi possível baixar o arquivo. Verifique a URL.');
      } else {
        const instrucoesPCMSO = `
📌 EXTRAÇÃO ESPECÍFICA PCMSO (NR-07):
- Identificar TODOS os exames por cargo/função
- Para cada exame: nome, código eSocial, quando realizar (admissional/periódico/demissional/retorno)
- Extrair periodicidade de cada exame (anual, semestral, a cada 12 meses, etc.)
- Identificar exames complementares: audiometria, espirometria, acuidade visual, laboratoriais
- No campo activity_type de cada ação use: admissional | periodico | demissional | treinamento | avaliacao_medica | retorno
- No campo esocial_code coloque o código eSocial (ex: 0281, 0295, 9999)
- Cada cargo é uma linha de ação com seus exames específicos`;

        const result = await invokeLLMWithPDF(pdfBase64, 'PCMSO — Controle Médico de Saúde Ocupacional (NR-07)', instrucoesPCMSO);
        await persistResult(result, true);
      }
    } catch (err) {
      console.error('[PCMSO] Erro:', err.message);
      results.errors.push(`PCMSO: ${err.message}`);
    }
  }

  const msg = `Análise concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades, ${results.non_conformities_created} não conformidades, ${results.employees_linked} vínculos.`;
  console.log('[FINAL]', msg);

  return Response.json({
    success: true,
    message: msg,
    ...results,
  });
});