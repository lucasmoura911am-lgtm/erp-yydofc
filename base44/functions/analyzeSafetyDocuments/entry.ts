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

  // Schema JSON alinhado com o formato do prompt (riscos PLANOS na raiz, não aninhados)
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
            consequencia_nao_execucao: { type: 'string' }
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

  // Schema específico para PCMSO — inclui campo activity_type em acoes
  const PCMSO_SCHEMA = JSON.parse(JSON.stringify(BASE_SCHEMA));
  PCMSO_SCHEMA.properties.acoes.items.properties.activity_type = { type: 'string' };
  PCMSO_SCHEMA.properties.acoes.items.properties.esocial_code = { type: 'string' };

  const PROMPT_BASE = `
Você é um engenheiro de segurança do trabalho especialista em NR-01, PGR e PCMSO.
Sua função NÃO é resumir o documento. Sua função é transformar o documento em EXECUÇÃO OPERACIONAL dentro de um sistema ERP.

🚨 OBJETIVO PRINCIPAL:
Converter o documento em: RISCOS, AÇÕES OBRIGATÓRIAS, TAREFAS EXECUTÁVEIS.

🚨 REGRA MAIS IMPORTANTE:
- Para CADA risco identificado → gerar pelo menos 1 ação e pelo menos 1 tarefa
- NÃO pode existir risco sem ação, NÃO pode existir ação sem tarefa

📌 EXTRAÇÃO OBRIGATÓRIA — Ler e extrair:
- setores (lista de strings, ex: ["Operacional", "Administrativo"])
- cargos por setor
- riscos ocupacionais (físico, químico, biológico, ergonômico, acidente)
- exames obrigatórios e suas frequências
- medidas de controle existentes

📌 REGRAS DE NEGÓCIO (aplique automaticamente):
SE risco = ruído/vibração  → ação: audiometria + protetor auricular
SE risco = químico         → ação: controle de exposição + EPI específico
SE risco = biológico       → ação: vacinação + monitoramento saúde
SE risco = ergonômico      → ação: avaliação ergonômica + ginástica laboral
SE risco = acidente        → ação: inspeção periódica + treinamento NR-35/NR-06

📌 CAMPOS OBRIGATÓRIOS:
- riscos[].tipo: exatamente um de: fisico, quimico, biologico, ergonomico, acidente
- riscos[].nivel_risco: exatamente um de: baixo, medio, alto, critico
- riscos[].probabilidade: exatamente um de: baixa, media, alta
- riscos[].severidade: exatamente um de: leve, moderada, grave, gravissima
- acoes[].tipo: exatamente um de: exame, epi, treinamento, inspecao, monitoramento
- acoes[].prioridade: exatamente um de: baixa, media, alta, urgente
- tarefas[].periodicidade: exatamente um de: unico, mensal, trimestral, semestral, anual, continuo

🚨 FORMATO OBRIGATÓRIO — retorne APENAS este JSON (sem texto fora):
{
  "empresa": "nome da empresa",
  "setores": ["Setor A", "Setor B"],
  "riscos": [
    { "id": "R1", "setor": "Operacional", "cargo": "Auxiliar", "tipo": "fisico", "descricao": "Exposição a ruído acima do NHO", "nivel_risco": "alto", "probabilidade": "alta", "severidade": "grave", "medidas_controle": ["Protetor auricular tipo concha"] }
  ],
  "acoes": [
    { "id": "A1", "risco_id": "R1", "titulo": "Audiometria periódica", "descricao": "Realizar audiometria ocupacional anual", "tipo": "exame", "setor": "Operacional", "frequencia": "anual", "prioridade": "alta", "prazo_dias": 30, "obrigacao_legal": true, "consequencia_nao_execucao": "Auto de infração NR-07" }
  ],
  "tarefas": [
    { "id": "T1", "acao_id": "A1", "titulo": "Agendar audiometria — Operacional", "descricao": "Agendar com clínica conveniada", "setor": "Operacional", "cargo": "Auxiliar", "periodicidade": "anual", "obrigatoria": true }
  ],
  "nao_conformidades": []
}

🚨 VALIDAÇÃO FINAL antes de responder:
- Existem setores? Se não, inferir do texto
- Cada risco tem ao menos 1 ação com risco_id correto?
- Cada ação tem ao menos 1 tarefa com acao_id correto?
- Extraiu TODOS os riscos do documento, não apenas os mais óbvios?`;

  const PROMPT_PCMSO_EXTRA = `

📌 EXTRAÇÃO ESPECÍFICA PCMSO (NR-07):
Identificar e extrair TODOS:
1. Exames por cargo/função (admissional, periódico, demissional, retorno ao trabalho)
2. Periodicidade de cada exame por risco associado
3. Exames complementares (audiometria, espirometria, acuidade visual, laboratoriais, etc.)
4. Médico coordenador e CRM se informado

Adicione em cada ação do PCMSO:
- activity_type: exatamente um de: admissional, periodico, demissional, treinamento, avaliacao_medica, retorno
- esocial_code: código eSocial do exame se identificável`;

  // ── ANÁLISE DO PGR ─────────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: PROMPT_BASE + '\n\nTipo de documento: PGR — Programa de Gerenciamento de Riscos (NR-01).\nLeia 100% do documento incluindo tabelas, anexos e observações.',
        file_urls: [pgr_file_url],
        response_json_schema: BASE_SCHEMA,
      });

      const riscos = result?.riscos || [];
      const acoes = result?.acoes || [];
      const tarefas = result?.tarefas || [];
      const riskIdMap = {};

      // 1. Criar riscos no BD
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

      // 2. Criar ações vinculadas
      const acaoIdMap = {};
      for (const acao of acoes) {
        if (!acao.titulo && !acao.descricao) continue;
        const priority = norm(acao.prioridade, VALID_PRIO, 'media');
        const prazo = addDays(today, Number(acao.prazo_dias) || 90);
        const created = await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: (acao.risco_id && riskIdMap[acao.risco_id]) || '',
          company_id,
          action_description: acao.titulo || acao.descricao,
          responsible: responsible || 'Responsável SST',
          deadline: prazo,
          status: 'pendente',
          priority,
          notes: [acao.descricao, acao.consequencia_nao_execucao ? `Consequência: ${acao.consequencia_nao_execucao}` : ''].filter(Boolean).join('\n'),
          category: norm(acao.tipo, VALID_CAT, 'outro'),
          legal_obligation: acao.obrigacao_legal !== false,
        });
        results.actions_created++;
        if (acao.id) acaoIdMap[acao.id] = created.id;
        await linkEmployees(acao.setor, prazo, acao.titulo || acao.descricao);
      }

      // 3. Criar tarefas como HealthActivityPlan (reuso de entidade) ou RiskActionPlan filho
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

      // Fallback: se nenhuma ação foi gerada, criar 1 por risco automaticamente
      if (acoes.length === 0) {
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
          action_description: `[NÃO CONFORMIDADE NR-01] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, Number(nc.prazo_dias) || 30),
          status: 'pendente',
          priority: g === 'alta' ? 'urgente' : 'alta',
          notes: nc.acao_corretiva || '',
          legal_obligation: true,
        });
        results.non_conformities_created++;
      }

    } catch (err) {
      results.errors.push(`PGR: ${err.message}`);
    }
  }

  // ── ANÁLISE DO PCMSO ───────────────────────────────────────────────────────
  if (pcmso_file_url) {
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: PROMPT_BASE + PROMPT_PCMSO_EXTRA + '\n\nTipo de documento: PCMSO — Programa de Controle Médico de Saúde Ocupacional (NR-07).\nLeia 100% do documento incluindo tabelas de exames, periodicidades e cargos.',
        file_urls: [pcmso_file_url],
        response_json_schema: PCMSO_SCHEMA,
      });

      const riscos = result?.riscos || [];
      const acoes = result?.acoes || [];
      const tarefas = result?.tarefas || [];
      const riskIdMap = {};

      // Criar riscos do PCMSO (podem ter riscos adicionais)
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

      // Criar atividades de saúde (PCMSO) e também RiskActionPlan para rastreio
      for (const acao of acoes) {
        if (!acao.titulo && !acao.descricao) continue;
        const actType = norm(acao.activity_type, VALID_ACT, 'periodico');
        const frequency = norm(acao.frequencia, VALID_FREQ, 'anual');
        const prazo = addDays(today, Number(acao.prazo_dias) || 365);

        // Criar HealthActivityPlan
        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id, company_id,
          activity_name: acao.titulo || acao.descricao,
          activity_type: actType,
          frequency,
          description: [acao.descricao, acao.setor ? `Setor: ${acao.setor}` : '', acao.cargo ? `Cargo: ${acao.cargo}` : '', acao.esocial_code ? `eSocial: ${acao.esocial_code}` : ''].filter(Boolean).join(' | '),
          active: true,
        });
        results.health_plans_created++;

        // Também criar ação no plano de ação para rastreio
        const priority = norm(acao.prioridade, VALID_PRIO, 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: (acao.risco_id && riskIdMap[acao.risco_id]) || '',
          company_id,
          action_description: `[PCMSO] ${acao.titulo || acao.descricao}`,
          responsible: responsible || 'Médico do Trabalho',
          deadline: prazo, status: 'pendente', priority,
          notes: [acao.descricao, acao.setor ? `Setor: ${acao.setor}` : '', acao.consequencia_nao_execucao || ''].filter(Boolean).join('\n'),
          category: 'exame',
          legal_obligation: true,
        });
        results.actions_created++;
        await linkEmployees(acao.setor, prazo, acao.titulo || acao.descricao);
      }

      // Tarefas do PCMSO
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
      }

      // Não conformidades PCMSO
      for (const nc of (result?.nao_conformidades || [])) {
        if (!nc.descricao) continue;
        const g = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: '', company_id,
          action_description: `[NÃO CONFORMIDADE PCMSO] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, Number(nc.prazo_dias) || 30),
          status: 'pendente',
          priority: g === 'alta' ? 'urgente' : 'alta',
          notes: nc.acao_corretiva || '',
          legal_obligation: true,
        });
        results.non_conformities_created++;
      }

    } catch (err) {
      results.errors.push(`PCMSO: ${err.message}`);
    }
  }

  return Response.json({
    success: true,
    message: `Análise concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades PCMSO/tarefas, ${results.non_conformities_created} não conformidades, ${results.employees_linked} vínculos.`,
    ...results,
  });
});