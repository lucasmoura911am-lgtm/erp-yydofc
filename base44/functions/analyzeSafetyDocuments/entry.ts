import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  const { program_id, contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();

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
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };

  // Buscar funcionários e setores da empresa para vínculo automático
  let employees = [];
  let departments = [];
  let positions = [];
  try {
    employees = await base44.asServiceRole.entities.Employee.filter({ company_id });
    departments = await base44.asServiceRole.entities.Department.filter({ company_id });
    positions = await base44.asServiceRole.entities.Position.filter({ company_id });
  } catch (e) {
    results.errors.push('Aviso: não foi possível carregar funcionários para vínculo: ' + e.message);
  }

  const VALID = {
    risk_types: ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'],
    risk_levels: ['baixo', 'medio', 'alto', 'critico'],
    probabilities: ['baixa', 'media', 'alta'],
    severities: ['leve', 'moderada', 'grave', 'gravissima'],
    priorities: ['baixa', 'media', 'alta', 'urgente'],
    act_types: ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica'],
    frequencies: ['unico', 'mensal', 'trimestral', 'semestral', 'anual'],
    action_categories: ['exame', 'treinamento', 'epi', 'epc', 'inspecao', 'monitoramento', 'outro'],
  };

  const norm = (val, list, def) => list.includes((val || '').toLowerCase().replace(/\s/g, '_')) ? (val || '').toLowerCase().replace(/\s/g, '_') : def;

  // ── PROMPT ESPECIALISTA NR-01 ─────────────────────────────────────────────
  const EXPERT_PROMPT = `Você é um especialista avançado em Segurança e Saúde do Trabalho (SST), com domínio completo da NR-01 (GRO), PGR, PCMSO e legislação brasileira.

Leia 100% do documento anexado. Não ignore tabelas, anexos, observações ou qualquer parte.

ETAPA 1 - IDENTIFIQUE todos:
- Setores/áreas da empresa
- Cargos e funções
- Perigos e riscos ocupacionais (físico, químico, biológico, ergonômico, acidente)
- Exames médicos previstos
- EPIs necessários
- Treinamentos obrigatórios
- Medidas preventivas e de controle
- Obrigações legais

ETAPA 2 - ESTRUTURE os riscos com:
- tipo: use exatamente um de: fisico, quimico, biologico, ergonomico, acidente
- nivel_risco: use exatamente um de: baixo, medio, alto, critico
- probabilidade: use exatamente um de: baixa, media, alta
- severidade: use exatamente um de: leve, moderada, grave, gravissima

ETAPA 3 - Para CADA risco, gere AÇÕES AUTOMÁTICAS:
- Exames médicos → tipo "exame", frequência obrigatória
- EPIs → tipo "epi", controle de entrega e substituição
- Treinamentos → tipo "treinamento", recorrente
- Inspeções → tipo "inspecao", periódica
- Riscos altos/críticos → prioridade "alta" ou "urgente"
- prioridade: use exatamente um de: baixa, media, alta, urgente
- prazo_dias: número inteiro de dias a partir de hoje (30, 60, 90, 180, 365)

ETAPA 4 - Para cada ação, indique setor e cargo para vínculo automático com funcionários.

ETAPA 5 - PCMSO: extraia TODAS as atividades de saúde previstas.
- activity_type: use exatamente um de: admissional, periodico, demissional, treinamento, avaliacao_medica
- frequency: use exatamente um de: unico, mensal, trimestral, semestral, anual

ETAPA 6 - IDENTIFIQUE não conformidades:
Se qualquer exigência da NR-01 não estiver coberta, gere uma não conformidade.
- gravidade: use exatamente um de: baixa, media, alta

REGRAS CRÍTICAS:
- NÃO RESUMIR. EXTRAIR TUDO.
- Todo risco DEVE ter pelo menos 1 ação.
- Retorne JSON válido e completo.`;

  // ── ANÁLISE DO PGR ─────────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      const pgrResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: EXPERT_PROMPT + `\n\nTipo de documento: PGR (Programa de Gerenciamento de Riscos) - NR-01\nFoco: Identificar TODOS os riscos ocupacionais e gerar plano de ação completo.`,
        file_urls: [pgr_file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            empresa: { type: 'string' },
            documento_tipo: { type: 'string' },
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
                        tipo: { type: 'string' },
                        descricao: { type: 'string' },
                        fonte_geradora: { type: 'string' },
                        nivel_risco: { type: 'string' },
                        probabilidade: { type: 'string' },
                        severidade: { type: 'string' },
                        medidas_controle: { type: 'array', items: { type: 'string' } },
                        acoes: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              titulo: { type: 'string' },
                              descricao: { type: 'string' },
                              tipo: { type: 'string' },
                              prioridade: { type: 'string' },
                              prazo_dias: { type: 'number' },
                              frequencia: { type: 'string' },
                              obrigacao_legal: { type: 'boolean' },
                              consequencia_nao_execucao: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
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
        }
      });

      // Processar setores e riscos
      const setores = pgrResult?.setores || [];
      for (const setor of setores) {
        const nomeSetor = setor.nome || '';
        const cargos = setor.cargos || [];
        const riscos = setor.riscos || [];

        // Encontrar dept_id e position_ids correspondentes
        const dept = departments.find(d => d.name && nomeSetor && d.name.toLowerCase().includes(nomeSetor.toLowerCase().slice(0, 5)));

        for (const risco of riscos) {
          if (!risco.descricao && !risco.tipo) continue;

          const riskType = norm(risco.tipo, VALID.risk_types, 'acidente');
          const riskLevel = norm(risco.nivel_risco, VALID.risk_levels, 'medio');
          const probability = norm(risco.probabilidade, VALID.probabilities, 'media');
          const severity = norm(risco.severidade, VALID.severities, 'moderada');
          const medidas = Array.isArray(risco.medidas_controle) ? risco.medidas_controle.join('; ') : (risco.medidas_controle || '');

          const createdRisk = await base44.asServiceRole.entities.RiskInventory.create({
            contract_id,
            company_id,
            department_id: dept?.id || '',
            risk_name: risco.descricao || risco.fonte_geradora || `Risco ${riskType}`,
            risk_type: riskType,
            risk_description: [risco.descricao, risco.fonte_geradora].filter(Boolean).join(' — '),
            risk_level: riskLevel,
            probability,
            severity,
            control_measures: medidas,
            active: true,
          });
          results.risks_created++;

          // Ações para o risco
          const acoes = risco.acoes || [];
          // Se risco não tem ações explícitas, gerar 1 ação padrão
          if (acoes.length === 0) {
            acoes.push({
              titulo: `Controle de risco: ${risco.descricao || riskType}`,
              descricao: medidas || `Implementar medidas de controle para ${risco.descricao}`,
              tipo: 'monitoramento',
              prioridade: riskLevel === 'critico' ? 'urgente' : riskLevel === 'alto' ? 'alta' : 'media',
              prazo_dias: riskLevel === 'critico' ? 30 : riskLevel === 'alto' ? 60 : 90,
              obrigacao_legal: true,
            });
          }

          for (const acao of acoes) {
            if (!acao.titulo && !acao.descricao) continue;
            const priority = norm(acao.prioridade, VALID.priorities, 'media');
            const prazo = addDays(today, acao.prazo_dias || 90);
            const actionCategory = norm(acao.tipo, VALID.action_categories, 'outro');

            await base44.asServiceRole.entities.RiskActionPlan.create({
              risk_id: createdRisk.id,
              company_id,
              action_description: acao.titulo || acao.descricao,
              responsible: responsible || 'Responsável SST',
              deadline: prazo,
              status: 'pendente',
              priority,
              notes: [acao.descricao, acao.consequencia_nao_execucao ? `Consequência: ${acao.consequencia_nao_execucao}` : ''].filter(Boolean).join('\n'),
              category: actionCategory,
              legal_obligation: acao.obrigacao_legal || false,
            });
            results.actions_created++;

            // Vincular funcionários do setor/cargo automaticamente
            if (employees.length > 0 && dept?.id) {
              const targetEmps = employees.filter(e => e.department_id === dept.id);
              for (const emp of targetEmps.slice(0, 50)) { // máx 50 por ação
                try {
                  await base44.asServiceRole.entities.EmployeeSafetyActivity.create({
                    employee_id: emp.id,
                    company_id,
                    contract_id,
                    status: 'pendente',
                    scheduled_date: prazo,
                    observations: `${acao.titulo || acao.descricao} — Setor: ${nomeSetor}`,
                  });
                  results.employees_linked++;
                } catch {}
              }
            }
          }
        }
      }

      // Não conformidades
      const naoConfs = pgrResult?.nao_conformidades || [];
      for (const nc of naoConfs) {
        if (!nc.descricao) continue;
        const gravity = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          company_id,
          risk_id: '',
          action_description: `[NÃO CONFORMIDADE] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, nc.prazo_dias || 30),
          status: 'pendente',
          priority: gravity === 'alta' ? 'urgente' : gravity === 'media' ? 'alta' : 'media',
          notes: `Ação corretiva: ${nc.acao_corretiva || ''}`,
          category: 'outro',
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
      const pcmsoResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: EXPERT_PROMPT + `\n\nTipo de documento: PCMSO (Programa de Controle Médico de Saúde Ocupacional) - NR-07\nFoco: Extrair TODOS os exames, avaliações médicas e atividades de saúde previstas, com periodicidade e cargos vinculados.`,
        file_urls: [pcmso_file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            medico_responsavel: { type: 'string' },
            crm: { type: 'string' },
            activities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  activity_name: { type: 'string' },
                  activity_type: { type: 'string' },
                  frequency: { type: 'string' },
                  description: { type: 'string' },
                  setor: { type: 'string' },
                  cargo: { type: 'string' },
                  prazo_dias: { type: 'number' },
                  obrigatorio: { type: 'boolean' },
                  esocial_code: { type: 'string' }
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
        }
      });

      const activities = pcmsoResult?.activities || [];
      for (const act of activities) {
        if (!act.activity_name) continue;
        const actType = norm(act.activity_type, VALID.act_types, 'periodico');
        const frequency = norm(act.frequency, VALID.frequencies, 'anual');

        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id,
          company_id,
          activity_name: act.activity_name,
          activity_type: actType,
          frequency,
          description: [act.description, act.setor ? `Setor: ${act.setor}` : '', act.cargo ? `Cargo: ${act.cargo}` : ''].filter(Boolean).join(' | '),
          active: true,
        });
        results.health_plans_created++;

        // Vincular funcionários ao setor/cargo do PCMSO
        if (employees.length > 0 && act.setor) {
          const dept = departments.find(d => d.name && act.setor && d.name.toLowerCase().includes(act.setor.toLowerCase().slice(0, 5)));
          if (dept) {
            const targetEmps = employees.filter(e => e.department_id === dept.id);
            const prazo = addDays(today, act.prazo_dias || 365);
            for (const emp of targetEmps.slice(0, 50)) {
              try {
                await base44.asServiceRole.entities.EmployeeSafetyActivity.create({
                  employee_id: emp.id,
                  company_id,
                  contract_id,
                  status: 'pendente',
                  scheduled_date: prazo,
                  observations: `${act.activity_name} — ${actType} — ${frequency}`,
                });
                results.employees_linked++;
              } catch {}
            }
          }
        }
      }

      // Não conformidades do PCMSO
      const naoConfs = pcmsoResult?.nao_conformidades || [];
      for (const nc of naoConfs) {
        if (!nc.descricao) continue;
        const gravity = norm(nc.gravidade, ['baixa', 'media', 'alta'], 'media');
        await base44.asServiceRole.entities.RiskActionPlan.create({
          company_id,
          risk_id: '',
          action_description: `[NÃO CONFORMIDADE PCMSO] ${nc.descricao}`,
          responsible: responsible || 'Responsável SST',
          deadline: addDays(today, nc.prazo_dias || 30),
          status: 'pendente',
          priority: gravity === 'alta' ? 'urgente' : 'alta',
          notes: `Ação corretiva: ${nc.acao_corretiva || ''}`,
          category: 'exame',
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
    message: `Análise NR-01 concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades PCMSO, ${results.non_conformities_created} não conformidades, ${results.employees_linked} vínculos com funcionários criados.`,
    ...results,
  });
});