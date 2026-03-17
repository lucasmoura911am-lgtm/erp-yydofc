import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_url, competencia, company_id } = await req.json();
    if (!pdf_url || !competencia || !company_id) {
      return Response.json({ error: 'pdf_url, competencia e company_id são obrigatórios' }, { status: 400 });
    }

    // Use LLM to extract payslip data from PDF
    const prompt = `
Você é um sistema especialista em leitura de holerites/contracheques brasileiros.

Analise o PDF de holerites em lote enviado e extraia os dados de CADA funcionário.

Para cada holerite individual, extraia:
- nome_funcionario: Nome completo do funcionário
- codigo_funcionario: Matrícula ou código do funcionário (pode ser numérico)  
- valor_liquido: Valor líquido a receber (apenas número, sem R$)
- competencia: Mês/ano de competência (formato MM/AAAA)

Retorne um array JSON com todos os funcionários encontrados.
Se não conseguir extrair algum campo, use null.

Arquivo PDF para análise: ${pdf_url}
Competência informada pelo usuário: ${competencia}
`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [pdf_url],
      response_json_schema: {
        type: "object",
        properties: {
          funcionarios: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome_funcionario: { type: "string" },
                codigo_funcionario: { type: "string" },
                valor_liquido: { type: "number" },
                competencia: { type: "string" }
              }
            }
          },
          total_encontrados: { type: "number" }
        }
      }
    });

    const funcionarios = result.funcionarios || [];

    // Load employees from company to match
    const employees = await base44.asServiceRole.entities.Employee.filter({ company_id });
    
    const batchId = `batch_${Date.now()}`;
    const created = [];
    const notMatched = [];

    for (const func of funcionarios) {
      if (!func.nome_funcionario) continue;

      // Try to match employee by code or name
      let matchedEmployee = null;
      
      if (func.codigo_funcionario) {
        matchedEmployee = employees.find(e => 
          e.employee_number === func.codigo_funcionario ||
          e.employee_number === String(func.codigo_funcionario)
        );
      }
      
      if (!matchedEmployee) {
        const nameLower = (func.nome_funcionario || '').toLowerCase().trim();
        matchedEmployee = employees.find(e => {
          const empName = (e.full_name || '').toLowerCase().trim();
          return empName === nameLower || 
                 empName.includes(nameLower.split(' ')[0]) ||
                 nameLower.includes(empName.split(' ')[0]);
        });
      }

      const payslipData = {
        company_id,
        employee_id: matchedEmployee?.id || null,
        employee_name: func.nome_funcionario,
        employee_code: func.codigo_funcionario || null,
        competencia: func.competencia || competencia,
        valor_liquido: func.valor_liquido || 0,
        arquivo_pdf_individual: pdf_url, // same PDF for now; individual split not yet supported
        batch_upload_id: batchId,
        data_upload: new Date().toISOString(),
        uploaded_by: user.email,
        status_assinado: 'pendente'
      };

      const record = await base44.asServiceRole.entities.SmartPayslip.create(payslipData);
      
      if (matchedEmployee) {
        created.push({ ...record, matched: true });
      } else {
        notMatched.push({ ...record, matched: false });
        created.push({ ...record, matched: false });
      }
    }

    return Response.json({
      success: true,
      batch_id: batchId,
      total_encontrados: funcionarios.length,
      total_criados: created.length,
      total_vinculados: created.filter(c => c.matched).length,
      total_nao_vinculados: notMatched.length,
      nao_vinculados: notMatched.map(n => n.employee_name)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});