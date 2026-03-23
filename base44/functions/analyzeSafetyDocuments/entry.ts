import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  const { contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();
  if (!contract_id || !company_id) {
    return Response.json({ error: 'contract_id e company_id são obrigatórios' }, { status: 400 });
  }

  const results = { risks_created: 0, actions_created: 0, health_plans_created: 0, non_conformities_created: 0, employees_linked: 0, errors: [] };
  const today = new Date();
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };

  let employees = [], departments = [];
  try {
    [employees, departments] = await Promise.all([
      base44.asServiceRole.entities.Employee.filter({ company_id }),
      base44.asServiceRole.entities.Department.filter({ company_id }),
    ]);
  } catch (e) {
    results.errors.push('Aviso vínculos: ' + e.message);
  }

  const VALID_RISK_TYPES = ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'];
  const VALID_LEVELS = ['baixo', 'medio', 'alto', 'critico'];
  const VALID_PROB = ['baixa', 'media', 'alta'];
  const VALID_SEV = ['leve', 'moderada', 'grave', 'gravissima'];
  const VALID_PRIO = ['baixa', 'media', 'alta', 'urgente'];
  const VALID_ACT = ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica', 'retorno'];
  const VALID_FREQ = ['unico', 'mensal', 'trimestral', 'semestral', 'anual', 'continuo'];
  const VALID_CAT = ['exame', 'epi', 'treinamento', 'inspecao', 'monitoramento', 'outro'];

  const norm = (val, list, def) => {
    const v = (val || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z_]/g, '').trim();
    return list.includes(v) ? v : def;
  };

  const findDept = (nomeSetor) => {
    if (!nomeSetor) return null;
    const s = nomeSetor.toLowerCase();
    return departments.find(d => d.name && d.name.toLowerCase().includes(s.slice(0, 6)));
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

  // Extrai texto: primeiro tenta ExtractDataFromUploadedFile (PDFs até 10MB)
  // Se falhar (PDF grande), usa o arquivo diretamente via file_urls no LLM
  const extractTextFromFile = async (file_url) => {
    try {
      const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Todo o conteúdo textual do documento' },
          }
        }
      });
      if (extracted?.status === 'success' && extracted?.output) {
        const out = extracted.output;
        if (typeof out === 'string' && out.length > 100) return out;
        if (out?.content && out.content.length > 100) return out.content;
      }
    } catch (e) {
      console.log('ExtractText falhou (provavelmente PDF grande), usando file_urls direto:', e.message);
    }
    return null; // null = usar file_urls direto no LLM
  };

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

  const buildPrompt = (tipoDoc, extraInstrucoes, textoDocumento) => `
Você é um engenheiro de segurança do trabalho especialista em NR-01, PGR e PCMSO.
Sua função é transformar o documento em EXECUÇÃO OPERACIONAL dentro de um sistema ERP.

Tipo de documento: ${tipoDoc}
${extraInstrucoes || ''}

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

📌 CAMPOS OBRIGATÓRIOS — use EXATAMENTE estes valores:
- riscos[].tipo: fisico | quimico | biologico | ergonomico | acidente
- riscos[].nivel_risco: baixo | medio | alto | critico
- riscos[].probabilidade: baixa | media | alta
- riscos[].severidade: leve | moderada | grave | gravissima
- acoes[].tipo: exame | epi | treinamento | inspecao | monitoramento
- acoes[].prioridade: baixa | media | alta | urgente
- acoes[].frequencia: unico | mensal | trimestral | semestral | anual | continuo
- tarefas[].periodicidade: unico | mensal | trimestral | semestral | anual | continuo

📄 DOCUMENTO A ANALISAR:
${textoDocumento}

Responda APENAS com o JSON estruturado. Sem texto fora do JSON.`;

  // Persiste os dados extraídos pelo LLM no banco de dados
  const persistResult = async (rawResult, isPCMSO) => {
    // O LLM às vezes envolve a resposta em {response: {...}}
    const result = rawResult?.response || rawResult || {};
    const riscos = result?.riscos || [];
    const acoes = result?.acoes || [];
    const tarefas = result?.tarefas || [];
    const riskIdMap = {};

    // 1. Criar riscos
    for (const risco of riscos) {
      if (!risco.descricao && !risco.tipo) continue;
      const created = await base44.asServiceRole.entities.RiskInventory.create({
        contract_id, company_id,
        department_id: findDept(risco.setor)?.id || '',
        risk_name: risco.descricao || `${risco.tipo} — ${risco.setor || ''}`,
        risk_type: norm(risco.tipo, VALID_RISK_TYPES, 'acidente'),
        risk_description: risco.descricao || '',
        risk_level: norm(risco.nivel_risco, VALID_LEVELS, 'medio'),
        probability: norm(risco.probabilidade, VALID_PROB, 'media'),
        severity: norm(risco.severidade, VALID_SEV, 'moderada'),
        control_measures: Array.isArray(risco.medidas_controle) ? risco.medidas_controle.join('; ') : '',
        active: true,
      });
      results.risks_created++;
      if (risco.id) riskIdMap[risco.id] = created.id;
    }

    // 2. Criar ações / atividades
    const acaoIdMap = {};
    for (const acao of acoes) {
      if (!acao.titulo && !acao.descricao) continue;
      const priority = norm(acao.prioridade, VALID_PRIO, 'media');
      const prazo = addDays(today, Number(acao.prazo_dias) || (isPCMSO ? 365 : 90));
      const realRiskId = (acao.risco_id && riskIdMap[acao.risco_id]) || '';

      // RiskActionPlan (rastreio)
      const prefix = isPCMSO ? '[PCMSO] ' : '';
      const created = await base44.asServiceRole.entities.RiskActionPlan.create({
        risk_id: realRiskId,
        company_id,
        action_description: prefix + (acao.titulo || acao.descricao),
        responsible: responsible || (isPCMSO ? 'Médico do Trabalho' : 'Responsável SST'),
        deadline: prazo, status: 'pendente', priority,
        notes: [acao.descricao, acao.consequencia_nao_execucao ? `Consequência: ${acao.consequencia_nao_execucao}` : ''].filter(Boolean).join('\n'),
        category: norm(acao.tipo, VALID_CAT, 'exame'),
        legal_obligation: acao.obrigacao_legal !== false,
      });
      results.actions_created++;
      if (acao.id) acaoIdMap[acao.id] = created.id;

      // HealthActivityPlan
      if (isPCMSO || norm(acao.tipo, VALID_CAT, '') === 'exame') {
        const actType = norm(acao.activity_type, VALID_ACT, 'periodico');
        const frequency = norm(acao.frequencia, VALID_FREQ, 'anual');
        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id, company_id,
          activity_name: acao.titulo || acao.descricao,
          activity_type: actType,
          frequency,
          description: [acao.descricao, acao.setor ? `Setor: ${acao.setor}` : '', acao.cargo ? `Cargo: ${acao.cargo}` : '', acao.esocial_code ? `eSocial: ${acao.esocial_code}` : ''].filter(Boolean).join(' | '),
          active: true,
        });
        results.health_plans_created++;
      }

      await linkEmployees(acao.setor, prazo, acao.titulo || acao.descricao);
    }

    // 3. Criar tarefas como HealthActivityPlan
    for (const tarefa of tarefas) {
      if (!tarefa.titulo) continue;
      await base44.asServiceRole.entities.HealthActivityPlan.create({
        contract_id, company_id,
        activity_name: tarefa.titulo,
        activity_type: 'periodico',
        frequency: norm(tarefa.periodicidade, VALID_FREQ, 'anual'),
        description: [tarefa.descricao, tarefa.setor ? `Setor: ${tarefa.setor}` : '', tarefa.cargo ? `Cargo: ${tarefa.cargo}` : ''].filter(Boolean).join(' | '),
        active: true,
      });
      results.health_plans_created++;
      await linkEmployees(tarefa.setor, addDays(today, 180), tarefa.titulo);
    }

    // Fallback: se nenhuma ação foi gerada, criar 1 por risco
    if (acoes.length === 0 && riscos.length > 0) {
      for (const risco of riscos) {
        if (!risco.descricao && !risco.tipo) continue;
        const lvl = norm(risco.nivel_risco, VALID_LEVELS, 'medio');
        const priority = lvl === 'critico' ? 'urgente' : lvl === 'alto' ? 'alta' : 'media';
        const prazo = addDays(today, lvl === 'critico' ? 30 : lvl === 'alto' ? 60 : 90);
        await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: (risco.id && riskIdMap[risco.id]) || '',
          company_id,
          action_description: `Controlar: ${risco.descricao || risco.tipo} — Setor: ${risco.setor || ''}`,
          responsible: responsible || 'Responsável SST',
          deadline: prazo, status: 'pendente', priority,
          notes: Array.isArray(risco.medidas_controle) ? risco.medidas_controle.join('; ') : '',
          legal_obligation: true,
        });
        results.actions_created++;
        await linkEmployees(risco.setor, prazo, risco.descricao || risco.tipo);
      }
    }

    // Não conformidades
    for (const nc of (result?.nao_conformidades || [])) {
      if (!nc.descricao) continue;
      const g = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
      await base44.asServiceRole.entities.RiskActionPlan.create({
        risk_id: '', company_id,
        action_description: `[NÃO CONFORMIDADE] ${nc.descricao}`,
        responsible: responsible || 'Responsável SST',
        deadline: addDays(today, Number(nc.prazo_dias) || 30),
        status: 'pendente',
        priority: g === 'alta' ? 'urgente' : 'alta',
        notes: nc.acao_corretiva || '',
        legal_obligation: true,
      });
      results.non_conformities_created++;
    }
  };

  // ── ANÁLISE DO PGR ─────────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      console.log('[PGR] Extraindo texto do arquivo...');
      const textoExtraido = await extractTextFromFile(pgr_file_url);
      
      if (!textoExtraido) {
        results.errors.push('PGR: Não foi possível extrair o conteúdo do arquivo. Verifique se é um PDF válido.');
      } else {
        console.log(`[PGR] Texto extraído: ${textoExtraido.length} caracteres. Enviando ao LLM...`);
        
        const instrucoesPGR = `
📌 EXTRAÇÃO ESPECÍFICA PGR (NR-01):
- Identificar TODOS os riscos por setor e cargo
- Extrair medidas de controle existentes e propostas
- Identificar não conformidades com prazos legais
- Criar plano de ação com prioridades baseadas no nível de risco`;

        const pgrPrompt = textoExtraido
          ? buildPrompt('PGR — Programa de Gerenciamento de Riscos (NR-01)', instrucoesPGR, textoExtraido.slice(0, 80000))
          : buildPrompt('PGR — Programa de Gerenciamento de Riscos (NR-01)', instrucoesPGR, '[DOCUMENTO ANEXADO COMO PDF - leia e extraia todas as informações de riscos, setores, cargos, medidas de controle e plano de ação]');

        const pgrPayload = {
          model: 'claude_sonnet_4_6',
          prompt: pgrPrompt,
          response_json_schema: BASE_SCHEMA,
        };
        if (!textoExtraido) pgrPayload.file_urls = [pgr_file_url];

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM(pgrPayload);

        console.log('[PGR] LLM retornou:', JSON.stringify(result).slice(0, 500));
        await persistResult(result, false);
      }
    } catch (err) {
      console.error('[PGR] Erro:', err.message);
      results.errors.push(`PGR: ${err.message}`);
    }
  }

  // ── ANÁLISE DO PCMSO ───────────────────────────────────────────────────────
  if (pcmso_file_url) {
    try {
      console.log('[PCMSO] Extraindo texto do arquivo...');
      const textoExtraido = await extractTextFromFile(pcmso_file_url);
      
      if (!textoExtraido) {
        results.errors.push('PCMSO: Não foi possível extrair o conteúdo do arquivo. Verifique se é um PDF válido.');
      } else {
        console.log(`[PCMSO] Texto extraído: ${textoExtraido.length} caracteres. Enviando ao LLM...`);
        
        const instrucoesPCMSO = `
📌 EXTRAÇÃO ESPECÍFICA PCMSO (NR-07):
- Identificar TODOS os exames por cargo/função (admissional, periódico, demissional, retorno)
- Extrair periodicidade de cada exame (anual, semestral, etc.)
- Identificar exames complementares: audiometria, espirometria, acuidade visual, laboratoriais
- No campo activity_type de cada ação use: admissional | periodico | demissional | treinamento | avaliacao_medica | retorno
- No campo esocial_code coloque o código eSocial se identificável`;

        const pcmsoPrompt = textoExtraido
          ? buildPrompt('PCMSO — Programa de Controle Médico de Saúde Ocupacional (NR-07)', instrucoesPCMSO, textoExtraido.slice(0, 80000))
          : buildPrompt('PCMSO — Programa de Controle Médico de Saúde Ocupacional (NR-07)', instrucoesPCMSO, '[DOCUMENTO ANEXADO COMO PDF - leia e extraia todos os exames, periodicidades, cargos e atividades de saúde ocupacional]');

        const pcmsoPayload = {
          model: 'claude_sonnet_4_6',
          prompt: pcmsoPrompt,
          response_json_schema: BASE_SCHEMA,
        };
        if (!textoExtraido) pcmsoPayload.file_urls = [pcmso_file_url];

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM(pcmsoPayload);

        console.log('[PCMSO] LLM retornou:', JSON.stringify(result).slice(0, 500));
        await persistResult(result, true);
      }
    } catch (err) {
      console.error('[PCMSO] Erro:', err.message);
      results.errors.push(`PCMSO: ${err.message}`);
    }
  }

  return Response.json({
    success: true,
    message: `Análise concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades/tarefas, ${results.non_conformities_created} não conformidades, ${results.employees_linked} vínculos.`,
    ...results,
  });
});