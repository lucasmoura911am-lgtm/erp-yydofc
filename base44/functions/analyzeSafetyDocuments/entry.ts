import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  const { program_id, contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();
  if (!contract_id || !company_id) {
    return Response.json({ error: 'contract_id e company_id são obrigatórios' }, { status: 400 });
  }

  const results = { risks_created: 0, actions_created: 0, health_plans_created: 0, non_conformities_created: 0, employees_linked: 0, errors: [] };
  const today = new Date();
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };

  let employees = [], departments = [], positions = [];
  try {
    [employees, departments, positions] = await Promise.all([
      base44.asServiceRole.entities.Employee.filter({ company_id }),
      base44.asServiceRole.entities.Department.filter({ company_id }),
      base44.asServiceRole.entities.Position.filter({ company_id }),
    ]);
  } catch (e) {
    results.errors.push('Aviso vínculos: ' + e.message);
  }

  const VALID = {
    risk_types: ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'],
    risk_levels: ['baixo', 'medio', 'alto', 'critico'],
    probabilities: ['baixa', 'media', 'alta'],
    severities: ['leve', 'moderada', 'grave', 'gravissima'],
    priorities: ['baixa', 'media', 'alta', 'urgente'],
    act_types: ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica'],
    frequencies: ['unico', 'mensal', 'trimestral', 'semestral', 'anual'],
    action_categories: ['exame', 'epi', 'treinamento', 'inspecao', 'monitoramento', 'outro'],
  };

  const norm = (val, list, def) => {
    const v = (val || '').toLowerCase().replace(/[^a-z_]/g, '').trim();
    return list.includes(v) ? v : def;
  };

  const findDept = (nomeSetor) => {
    if (!nomeSetor) return null;
    return departments.find(d => d.name && d.name.toLowerCase().includes((nomeSetor || '').toLowerCase().slice(0, 5)));
  };

  const saveEmployeeLinks = async (dept, prazo, descricao) => {
    if (!dept?.id || employees.length === 0) return;
    const targets = employees.filter(e => e.department_id === dept.id).slice(0, 50);
    for (const emp of targets) {
      try {
        await base44.asServiceRole.entities.EmployeeSafetyActivity.create({
          employee_id: emp.id, company_id, contract_id,
          status: 'pendente', scheduled_date: prazo, observations: descricao,
        });
        results.employees_linked++;
      } catch {}
    }
  };

  const EXPERT_PROMPT = `
Você é um especialista em Segurança e Saúde do Trabalho com domínio completo da NR-01 (GRO), PGR e PCMSO.

Sua função é analisar COMPLETAMENTE o documento fornecido e transformar TODAS as informações em ações operacionais.

🚨 REGRAS CRÍTICAS (OBRIGATÓRIO):
- NÃO resumir
- NÃO ignorar tabelas
- NÃO ignorar setores
- NÃO ignorar riscos
- NÃO escrever texto fora do JSON
- Se não encontrar algo, usar null
- TODA informação relevante deve virar RISCO ou AÇÃO

ETAPA 1 — LEITURA COMPLETA: Leia TODO o documento e identifique empresa, setores, cargos, riscos, exames, EPIs, treinamentos, medidas preventivas, obrigações legais.

ETAPA 2 — IDENTIFICAÇÃO DE RISCOS: Para cada setor encontrado, identifique TODOS os riscos.
- tipo: use exatamente um de: fisico, quimico, biologico, ergonomico, acidente
- nivel_risco: use exatamente um de: baixo, medio, alto, critico
- probabilidade: use exatamente um de: baixa, media, alta
- severidade: use exatamente um de: leve, moderada, grave, gravissima

ETAPA 3 — GERAÇÃO AUTOMÁTICA DE AÇÕES: CADA risco identificado DEVE gerar pelo menos 1 ação.
- tipo: use exatamente um de: exame, epi, treinamento, inspecao, monitoramento
- prioridade: use exatamente um de: baixa, media, alta, urgente
- risco_id deve referenciar o id do risco (ex: "R1")
- prazo_dias: número inteiro

ETAPA 4 — PRIORIZAÇÃO: risco alto → alta, médio → media, baixo → baixa

ETAPA 5 — FREQUÊNCIA: exames → anual, treinamentos → anual, inspeções → mensal, EPIs → continuo

ETAPA 6 — NÃO CONFORMIDADES: Se o documento não tiver riscos ou ações preventivas, crie não conformidade NR-01.
- gravidade: use exatamente um de: baixa, media, alta

🚨 FORMATO OBRIGATÓRIO — retorne APENAS este JSON:
{
  "empresa": "",
  "setores": [
    {
      "nome": "",
      "cargos": [],
      "riscos": [
        {
          "id": "R1",
          "tipo": "fisico",
          "descricao": "",
          "nivel_risco": "medio",
          "probabilidade": "media",
          "severidade": "moderada",
          "medidas_controle": []
        }
      ]
    }
  ],
  "acoes": [
    {
      "id": "A1",
      "titulo": "",
      "descricao": "",
      "tipo": "exame",
      "risco_id": "R1",
      "setor": "",
      "frequencia": "anual",
      "prioridade": "media",
      "prazo_dias": 90,
      "obrigacao_legal": true,
      "consequencia_nao_execucao": ""
    }
  ],
  "nao_conformidades": [
    {
      "descricao": "",
      "gravidade": "media",
      "acao_corretiva": "",
      "prazo_dias": 30
    }
  ]
}

🚨 VALIDAÇÃO FINAL: verifique se cada risco tem ao menos 1 ação vinculada pelo risco_id.`;

  const JSON_SCHEMA = {
    type: 'object',
    properties: {
      empresa: { type: 'string' },
      setores: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            cargos: { type: 'array', items: { type: 'string' } },
            riscos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  tipo: { type: 'string' },
                  descricao: { type: 'string' },
                  nivel_risco: { type: 'string' },
                  probabilidade: { type: 'string' },
                  severidade: { type: 'string' },
                  medidas_controle: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      },
      acoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            tipo: { type: 'string' },
            risco_id: { type: 'string' },
            setor: { type: 'string' },
            frequencia: { type: 'string' },
            prioridade: { type: 'string' },
            prazo_dias: { type: 'number' },
            obrigacao_legal: { type: 'boolean' },
            consequencia_nao_execucao: { type: 'string' }
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

  // ── ANÁLISE DO PGR ─────────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      const pgrResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: EXPERT_PROMPT + '\n\nTipo de documento: PGR — Programa de Gerenciamento de Riscos (NR-01).',
        file_urls: [pgr_file_url],
        response_json_schema: JSON_SCHEMA,
      });

      // Mapear riscos por setor → BD
      const riskIdMap = {}; // "R1" → real DB id
      for (const setor of (pgrResult?.setores || [])) {
        const dept = findDept(setor.nome);
        for (const risco of (setor.riscos || [])) {
          if (!risco.descricao && !risco.tipo) continue;
          const riskType = norm(risco.tipo, VALID.risk_types, 'acidente');
          const riskLevel = norm(risco.nivel_risco, VALID.risk_levels, 'medio');
          const probability = norm(risco.probabilidade, VALID.probabilities, 'media');
          const severity = norm(risco.severidade, VALID.severities, 'moderada');
          const medidas = Array.isArray(risco.medidas_controle) ? risco.medidas_controle.join('; ') : '';

          const created = await base44.asServiceRole.entities.RiskInventory.create({
            contract_id, company_id,
            department_id: dept?.id || '',
            risk_name: risco.descricao || `Risco ${riskType} — ${setor.nome || ''}`,
            risk_type: riskType,
            risk_description: risco.descricao || '',
            risk_level: riskLevel,
            probability, severity,
            control_measures: medidas,
            active: true,
          });
          results.risks_created++;
          if (risco.id) riskIdMap[risco.id] = created.id;
        }
      }

      // Processar ações do nível raiz
      const acoes = pgrResult?.acoes || [];

      // Se o LLM não gerou ações separadas, criar 1 por risco como fallback
      if (acoes.length === 0) {
        for (const setor of (pgrResult?.setores || [])) {
          for (const risco of (setor.riscos || [])) {
            if (!risco.descricao && !risco.tipo) continue;
            const riskLevel = norm(risco.nivel_risco, VALID.risk_levels, 'medio');
            const priority = riskLevel === 'critico' ? 'urgente' : riskLevel === 'alto' ? 'alta' : 'media';
            const prazo = addDays(today, riskLevel === 'critico' ? 30 : riskLevel === 'alto' ? 60 : 90);
            await base44.asServiceRole.entities.RiskActionPlan.create({
              risk_id: (risco.id && riskIdMap[risco.id]) || '',
              company_id,
              action_description: `Controlar risco: ${risco.descricao || risco.tipo} — Setor: ${setor.nome || ''}`,
              responsible: responsible || 'Responsável SST',
              deadline: prazo, status: 'pendente', priority,
              notes: Array.isArray(risco.medidas_controle) ? risco.medidas_controle.join('; ') : '',
              legal_obligation: true,
            });
            results.actions_created++;
            await saveEmployeeLinks(findDept(setor.nome), prazo, `Controle: ${risco.descricao || risco.tipo}`);
          }
        }
      } else {
        for (const acao of acoes) {
          if (!acao.titulo && !acao.descricao) continue;
          const priority = norm(acao.prioridade, VALID.priorities, 'media');
          const prazo = addDays(today, acao.prazo_dias || 90);
          const category = norm(acao.tipo, VALID.action_categories, 'outro');
          const realRiskId = (acao.risco_id && riskIdMap[acao.risco_id]) || '';

          await base44.asServiceRole.entities.RiskActionPlan.create({
            risk_id: realRiskId,
            company_id,
            action_description: acao.titulo || acao.descricao,
            responsible: responsible || 'Responsável SST',
            deadline: prazo, status: 'pendente', priority,
            notes: [acao.descricao, acao.consequencia_nao_execucao ? `Consequência: ${acao.consequencia_nao_execucao}` : ''].filter(Boolean).join('\n'),
            category,
            legal_obligation: acao.obrigacao_legal || false,
          });
          results.actions_created++;
          await saveEmployeeLinks(findDept(acao.setor), prazo, acao.titulo || acao.descricao);
        }
      }

      // Não conformidades PGR
      for (const nc of (pgrResult?.nao_conformidades || [])) {
        if (!nc.descricao) continue;
        const gravity = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: '', company_id,
          action_description: `[NÃO CONFORMIDADE NR-01] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, nc.prazo_dias || 30),
          status: 'pendente',
          priority: gravity === 'alta' ? 'urgente' : 'alta',
          notes: `Ação corretiva: ${nc.acao_corretiva || ''}`,
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
      const PCMSO_SCHEMA = {
        type: 'object',
        properties: {
          empresa: { type: 'string' },
          medico_responsavel: { type: 'string' },
          crm: { type: 'string' },
          setores: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string' },
                cargos: { type: 'array', items: { type: 'string' } },
                riscos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' }, tipo: { type: 'string' },
                      descricao: { type: 'string' }, nivel_risco: { type: 'string' },
                      probabilidade: { type: 'string' }, severidade: { type: 'string' },
                      medidas_controle: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            }
          },
          acoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' }, titulo: { type: 'string' }, descricao: { type: 'string' },
                tipo: { type: 'string' }, risco_id: { type: 'string' }, setor: { type: 'string' },
                frequencia: { type: 'string' }, prioridade: { type: 'string' },
                prazo_dias: { type: 'number' }, obrigacao_legal: { type: 'boolean' },
                esocial_code: { type: 'string' }, activity_type: { type: 'string' }
              }
            }
          },
          nao_conformidades: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' }, gravidade: { type: 'string' },
                acao_corretiva: { type: 'string' }, prazo_dias: { type: 'number' }
              }
            }
          }
        }
      };

      const pcmsoResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: EXPERT_PROMPT + '\n\nTipo de documento: PCMSO — Programa de Controle Médico de Saúde Ocupacional (NR-07).\nFoco: extrair TODOS os exames ocupacionais e atividades de saúde com periodicidade, cargo e setor.\nNo campo "acoes", inclua também o campo "activity_type" com um de: admissional, periodico, demissional, treinamento, avaliacao_medica\nNo campo "acoes", inclua "frequencia" com um de: unico, mensal, trimestral, semestral, anual',
        file_urls: [pcmso_file_url],
        response_json_schema: PCMSO_SCHEMA,
      });

      const acoesPCMSO = pcmsoResult?.acoes || [];
      for (const acao of acoesPCMSO) {
        if (!acao.titulo && !acao.descricao) continue;
        const actType = norm(acao.activity_type, VALID.act_types, 'periodico');
        const frequency = norm(acao.frequencia, VALID.frequencies, 'anual');

        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id, company_id,
          activity_name: acao.titulo || acao.descricao,
          activity_type: actType,
          frequency,
          description: [acao.descricao, acao.setor ? `Setor: ${acao.setor}` : ''].filter(Boolean).join(' | '),
          active: true,
        });
        results.health_plans_created++;

        // Vincular funcionários
        const prazo = addDays(today, acao.prazo_dias || 365);
        await saveEmployeeLinks(findDept(acao.setor), prazo, acao.titulo || acao.descricao);
      }

      // Não conformidades PCMSO
      for (const nc of (pcmsoResult?.nao_conformidades || [])) {
        if (!nc.descricao) continue;
        const gravity = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          risk_id: '', company_id,
          action_description: `[NÃO CONFORMIDADE PCMSO] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, nc.prazo_dias || 30),
          status: 'pendente',
          priority: gravity === 'alta' ? 'urgente' : 'alta',
          notes: `Ação corretiva: ${nc.acao_corretiva || ''}`,
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
    message: `Análise NR-01 concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades PCMSO, ${results.non_conformities_created} não conformidades, ${results.employees_linked} vínculos com funcionários.`,
    ...results,
  });
});