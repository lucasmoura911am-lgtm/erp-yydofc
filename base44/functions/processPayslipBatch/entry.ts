import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_url, competencia, company_id } = await req.json();
    if (!pdf_url || !competencia || !company_id) {
      return Response.json({ error: 'pdf_url, competencia e company_id são obrigatórios' }, { status: 400 });
    }

    // Step 1: Download the original PDF
    const pdfResponse = await fetch(pdf_url);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBytes);
    const totalPages = originalPdf.getPageCount();

    // Step 2: Use LLM to identify each employee and which page(s) belong to them
    const prompt = `
Você é um sistema especialista em leitura de holerites/contracheques brasileiros.

Analise o PDF de holerites em lote com ${totalPages} páginas e identifique cada funcionário.

Para cada holerite individual, extraia:
- nome_funcionario: Nome completo do funcionário
- codigo_funcionario: Matrícula ou código do funcionário (pode ser numérico)
- valor_liquido: Valor líquido a receber (apenas número, sem R$)
- competencia: Mês/ano de competência (formato MM/AAAA)
- paginas: Array com os números das páginas que pertencem a este funcionário (começando em 1)

Retorne um array JSON com todos os funcionários encontrados.
Se não conseguir extrair algum campo, use null.
IMPORTANTE: Cada funcionário geralmente tem 1 ou 2 páginas. Liste exatamente quais páginas pertencem a cada um.

Competência informada pelo usuário: ${competencia}
Total de páginas do PDF: ${totalPages}
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
                competencia: { type: "string" },
                paginas: { type: "array", items: { type: "number" } }
              }
            }
          }
        }
      }
    });

    const funcionarios = result.funcionarios || [];

    // Step 3: Load employees from company to match
    const employees = await base44.asServiceRole.entities.Employee.filter({ company_id });

    const batchId = `batch_${Date.now()}`;
    const created = [];
    const notMatched = [];

    for (const func of funcionarios) {
      if (!func.nome_funcionario) continue;

      // Match employee by code or name
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

      // Step 4: Extract individual pages for this employee
      let individualPdfUrl = pdf_url; // fallback to full PDF
      const pageNumbers = (func.paginas || []).filter(p => p >= 1 && p <= totalPages);

      if (pageNumbers.length > 0) {
        try {
          const individualPdf = await PDFDocument.create();
          // Copy the employee's pages
          const pageIndices = pageNumbers.map(p => p - 1); // convert to 0-based
          const copiedPages = await individualPdf.copyPages(originalPdf, pageIndices);
          copiedPages.forEach(page => individualPdf.addPage(page));

          const individualPdfBytes = await individualPdf.save();

          // Upload individual PDF
          const blob = new Blob([individualPdfBytes], { type: 'application/pdf' });
          const file = new File([blob], `holerite_${func.nome_funcionario.replace(/\s+/g, '_')}_${competencia.replace('/', '-')}.pdf`, { type: 'application/pdf' });
          const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
          individualPdfUrl = file_url;
        } catch (splitErr) {
          console.error('Erro ao separar páginas:', splitErr.message);
          // fallback to full PDF
        }
      }

      const payslipData = {
        company_id,
        employee_id: matchedEmployee?.id || null,
        employee_name: func.nome_funcionario,
        employee_code: func.codigo_funcionario || null,
        competencia: func.competencia || competencia,
        valor_liquido: func.valor_liquido || 0,
        arquivo_pdf_individual: individualPdfUrl,
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
      total_paginas: totalPages,
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