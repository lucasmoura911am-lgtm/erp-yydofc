import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  const { program_id, contract_id, company_id, pgr_file_url, pcmso_file_url, responsible } = await req.json();

  if (!contract_id || !company_id) {
    return Response.json({ error: 'contract_id e company_id são obrigatórios' }, { status: 400 });
  }

  const results = { risks_created: 0, actions_created: 0, health_plans_created: 0, errors: [] };
  const today = new Date();

  // ── 1. Analisar PGR ───────────────────────────────────────────────────────
  if (pgr_file_url) {
    try {
      const pgrResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: pgr_file_url,
        json_schema: {
          type: "object",
          properties: {
            risks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  risk_name: { type: "string" },
                  risk_type: { type: "string", description: "fisico | quimico | biologico | ergonomico | acidente" },
                  risk_description: { type: "string" },
                  risk_level: { type: "string", description: "baixo | medio | alto | critico" },
                  probability: { type: "string", description: "baixa | media | alta" },
                  severity: { type: "string", description: "leve | moderada | grave | gravissima" },
                  control_measures: { type: "string" },
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action_description: { type: "string" },
                        responsible: { type: "string" },
                        deadline_days: { type: "number" },
                        priority: { type: "string", description: "baixa | media | alta | urgente" },
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

      if (pgrResult.status !== 'success') {
        results.errors.push(`PGR: ${pgrResult.details || 'Falha ao extrair dados'}`);
      } else {
        const risks = (pgrResult.output?.risks || pgrResult.output || []);
        const validRiskTypes = ['fisico', 'quimico', 'biologico', 'ergonomico', 'acidente'];
        const validRiskLevels = ['baixo', 'medio', 'alto', 'critico'];
        const validProbabilities = ['baixa', 'media', 'alta'];
        const validSeverities = ['leve', 'moderada', 'grave', 'gravissima'];
        const validPriorities = ['baixa', 'media', 'alta', 'urgente'];

        for (const risk of Array.isArray(risks) ? risks : []) {
          if (!risk.risk_name) continue;

          const riskType = validRiskTypes.includes(risk.risk_type) ? risk.risk_type : 'acidente';
          const riskLevel = validRiskLevels.includes(risk.risk_level) ? risk.risk_level : 'medio';
          const probability = validProbabilities.includes(risk.probability) ? risk.probability : 'media';
          const severity = validSeverities.includes(risk.severity) ? risk.severity : 'moderada';

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

          for (const action of (risk.actions || [])) {
            if (!action.action_description) continue;
            const priority = validPriorities.includes(action.priority) ? action.priority : 'media';
            const deadlineDays = action.deadline_days || 90;
            const deadline = new Date(today);
            deadline.setDate(deadline.getDate() + deadlineDays);
            const deadlineStr = deadline.toISOString().split('T')[0];

            await base44.asServiceRole.entities.RiskActionPlan.create({
              risk_id: createdRisk.id,
              company_id,
              action_description: action.action_description,
              responsible: action.responsible || responsible || 'Responsável SST',
              deadline: deadlineStr,
              status: 'pendente',
              priority,
              notes: action.notes || '',
            });
            results.actions_created++;
          }
        }
      }
    } catch (err) {
      results.errors.push(`PGR: ${err.message}`);
    }
  }

  // ── 2. Analisar PCMSO ─────────────────────────────────────────────────────
  if (pcmso_file_url) {
    try {
      const pcmsoResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: pcmso_file_url,
        json_schema: {
          type: "object",
          properties: {
            activities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  activity_name: { type: "string" },
                  activity_type: { type: "string", description: "admissional | periodico | demissional | treinamento | avaliacao_medica" },
                  frequency: { type: "string", description: "unico | mensal | trimestral | semestral | anual" },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (pcmsoResult.status !== 'success') {
        results.errors.push(`PCMSO: ${pcmsoResult.details || 'Falha ao extrair dados'}`);
      } else {
        const activities = (pcmsoResult.output?.activities || pcmsoResult.output || []);
        const validTypes = ['admissional', 'periodico', 'demissional', 'treinamento', 'avaliacao_medica'];
        const validFreqs = ['unico', 'mensal', 'trimestral', 'semestral', 'anual'];

        for (const act of Array.isArray(activities) ? activities : []) {
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
      }
    } catch (err) {
      results.errors.push(`PCMSO: ${err.message}`);
    }
  }

  return Response.json({
    success: true,
    message: `Leitura concluída: ${results.risks_created} riscos, ${results.actions_created} ações, ${results.health_plans_created} atividades PCMSO criadas.`,
    ...results,
  });
});