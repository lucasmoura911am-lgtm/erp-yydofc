/**
 * Processa tarefas recorrentes (diárias/semanais) e cria instâncias para hoje.
 * Chamado por automação agendada (diária) — nunca pelo frontend.
 * 
 * Rota: POST /processRecurringTasks
 * Auth: admin only
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
    const todayDow = dayNames[now.getDay()];

    // Busca todas as tasks recorrentes não canceladas da empresa do admin
    const allTasks = await base44.asServiceRole.entities.Task.filter({
      company_id: user.company_id,
    });

    const recurringTasks = allTasks.filter(t =>
      (t.frequency === 'diaria' || t.frequency === 'semanal') &&
      t.status !== 'cancelada'
    );

    let created = 0;
    let skipped = 0;

    for (const task of recurringTasks) {
      // Para semanal: só cria se hoje é um dos dias configurados
      if (task.frequency === 'semanal') {
        const days = task.scheduled_days || [];
        if (days.length > 0 && !days.includes(todayDow)) {
          skipped++;
          continue;
        }
      }

      // Verifica se já existe uma instância para hoje
      const existingToday = allTasks.find(t =>
        t.employee_id === task.employee_id &&
        t.title === task.title &&
        t.template_id === task.id &&
        t.due_date?.substring(0, 10) === todayStr
      );

      if (existingToday) {
        skipped++;
        continue;
      }

      // Monta due_date de hoje com o horário original ou 23:59
      const baseTime = task.scheduled_start_time || "23:59";
      const newDueDate = `${todayStr}T${baseTime}:00.000Z`;

      await base44.asServiceRole.entities.Task.create({
        title: task.title,
        description: task.description || "",
        employee_id: task.employee_id,
        company_id: task.company_id,
        supervisor_email: task.supervisor_email || "",
        allocation_id: task.allocation_id || "",
        client_id: task.client_id || "",
        due_date: newDueDate,
        scheduled_start_time: task.scheduled_start_time || "",
        scheduled_end_time: task.scheduled_end_time || "",
        scheduled_days: task.scheduled_days || [],
        location: task.location || "",
        priority: task.priority || "media",
        frequency: "avulsa", // instância é avulsa; o template controla recorrência
        status: "pendente",
        template_id: task.id, // referência ao template
        is_template: false,
      });
      created++;
    }

    return Response.json({
      ok: true,
      message: `Processamento concluído: ${created} criadas, ${skipped} ignoradas`,
      created,
      skipped,
      date: todayStr,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});