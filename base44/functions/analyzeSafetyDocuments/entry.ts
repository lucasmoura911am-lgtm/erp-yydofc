import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Acesso negado' }, { status: 403 });

  const { program_id, contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();

  if (!contract_id || !company_id) {
    return Response.json({ error: 'contract_id e company_id são obrigatórios' }, { status: 400 });
  }

  const results = { risks_created: 0, actions_created: 0, health_plans_created: 0, errors: [] };

  // ── 1. Analisar PGR ───────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      const pgrResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em segurança do trabalho brasileiro (SST/NR-01).
Leia o documento PGR (Programa de Gerenciamento de Riscos) anexado e extraia TODOS os riscos ocupacionais identificados e as ações do plano de ação.

REGRAS IMPORTANTÍSSIMAS:
- NÃO invente dados. Use APENAS o que está escrito no documento.
- Extraia todos os riscos mencionados, com seus respectivos tipos, descrições, níveis e medidas de controle.
- Para cada risco, extraia também as ações corretivas/preventivas previstas.
- Se o documento não mencionar um campo específico, deixe como string vazia ou null.
- risk_type deve ser um de: fisico, quimico, biologico, ergonomico, acidente
- risk_level deve ser um de: baixo, medio, alto, critico
- probability deve ser um de: baixa, media, alta
- severity deve ser um de: leve, moderada, grave, gravissima
- action_priority deve ser um de: baixa, media, alta, urgente
- deadline_days deve ser o número de dias a partir de hoje para o prazo da ação (30, 60, 90, 180, 365)

Retorne um JSON válido com a estrutura exata solicitada.`,
        file_urls: [pgr_file_url],
        response_json_schema: {
          type: "object",
          properties: {
            risks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  risk_name: { type: "string" },
                  risk_type: { type: "string" },
                  risk_description: { type: "string" },
                  risk_level: { type: "string" },
                  probability: { type: "string" },
                  severity: { type: "string" },
                  control_measures: { type: "string" },
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action_description: { type: "string" },
                        responsible: { type: "string" },
                        deadline_days: { type: "number" },
                        priority: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const risks = pgrResult?.risks || [];
      const today = new Date();

      for (const risk of risks) {
        if (!risk.risk_name) continue;

        // Validar e normalizar campos de enum
        const validRiskTypes = ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'];
        const validRiskLevels = ['baixo', 'medio', 'alto', 'critico'];
        const validProbabilities = ['baixa', 'media', 'alta'];
        const validSeverities = ['leve', 'moderada', 'grave', 'gravissima'];

        const riskType = validRiskTypes.includes(risk.risk_type) ? risk.risk_type : 'acidente';
        const riskLevel = validRiskLevels.includes(risk.risk_level) ? risk.risk_level : 'medio';
        const probability = validProbabilities.includes(risk.probability) ? risk.probability : 'media';
        const severity = validSeverities.includes(risk.severity) ? risk.severity : 'moderada';

        // Criar risco no inventário
        const createdRisk = await base44.asServiceRole.entities.RiskInventory.create({
          contract_id,
          company_id,
          risk_name: risk.risk_name,
          risk_type: riskType,
          risk_description: risk.risk_description || '',
          risk_level: riskLevel,
          probability,
          severity,
          control_measures: risk.control_measures || '',
          active: true,
        });

        results.risks_created++;

        // Criar ações vinculadas ao risco
        const actions = risk.actions || [];
        for (const action of actions) {
          if (!action.action_description) continue;

          const validPriorities = ['baixa', 'media', 'alta', 'urgente'];
          const priority = validPriorities.includes(action.priority) ? action.priority : 'media';
          const deadlineDays = action.deadline_days || 90;
          const deadline = new Date(today);
          deadline.setDate(deadline.getDate() + deadlineDays);
          const deadlineStr = deadline.toISOString().split('T')[0];

          await base44.asServiceRole.entities.RiskActionPlan.create({
            risk_id: createdRisk.id,
            company_id,
            action_description: action.action_description,
            responsible: action.responsible || responsible || 'Responsável de SST',
            deadline: deadlineStr,
            status: 'pendente',
            priority,
            notes: action.notes || '',
          });

          results.actions_created++;
        }
      }
    } catch (err) {
      results.errors.push(`PGR: ${err.message}`);
    }
  }

  // ── 2. Analisar PCMSO ─────────────────────────────────────────────────────
  if (pcmso_file_url) {
    try {
      const pcmsoResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em medicina do trabalho brasileiro (SST/NR-07).
Leia o documento PCMSO (Programa de Controle Médico de Saúde Ocupacional) anexado e extraia TODAS as atividades de saúde previstas no programa.

REGRAS IMPORTANTÍSSIMAS:
- NÃO invente dados. Use APENAS o que está escrito no documento.
- Extraia todos os exames, avaliações, treinamentos e atividades médicas previstas.
- activity_type deve ser um de: admissional, periodico, demissional, treinamento, avaliacao_medica
- frequency deve ser um de: unico, mensal, trimestral, semestral, anual
- Se não houver frequência explícita, use "anual" para exames periódicos.

Retorne um JSON válido com a estrutura exata solicitada.`,
        file_urls: [pcmso_file_url],
        response_json_schema: {
          type: "object",
          properties: {
            activities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  activity_name: { type: "string" },
                  activity_type: { type: "string" },
                  frequency: { type: "string" },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      });

      const activities = pcmsoResult?.activities || [];
      const validTypes = ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica'];
      const validFreqs = ['unico', 'mensal', 'trimestral', 'semestral', 'anual'];

      for (const act of activities) {
        if (!act.activity_name) continue;

        const actType = validTypes.includes(act.activity_type) ? act.activity_type : 'periodico';
        const frequency = validFreqs.includes(act.frequency) ? act.frequency : 'anual';

        await base44.asServiceRole.entities.HealthActivityPlan.create({
          contract_id,
          company_id,
          activity_name: act.activity_name,
          activity_type: actType,
          frequency,
          description: act.description || '',
          active: true,
        });

        results.health_plans_created++;
      }
    } catch (err) {
      results.errors.push(`PCMSO: ${err.message}`);
    }
  }

  return Response.json({
    success: true,
    message: `Análise concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades PCMSO criadas.`,
    ...results,
  });
});