import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report_id } = await req.json();
    if (!report_id) return Response.json({ error: 'report_id obrigatório' }, { status: 400 });

    // Load report
    const reports = await base44.asServiceRole.entities.SignedTimeReport.filter({ id: report_id });
    if (!reports.length) return Response.json({ error: 'Relatório não encontrado' }, { status: 404 });
    const report = reports[0];

    // Load employee name
    let employeeName = 'Funcionário';
    try {
      const emps = await base44.asServiceRole.entities.Employee.filter({ id: report.employee_id });
      if (emps.length > 0) employeeName = emps[0].full_name || employeeName;
    } catch {}

    let pdfDoc;

    // If there's an existing file, load it; otherwise create blank
    if (report.file_url) {
      try {
        const pdfResponse = await fetch(report.file_url);
        const pdfBytes = await pdfResponse.arrayBuffer();
        pdfDoc = await PDFDocument.load(pdfBytes);
      } catch {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595, 842]); // A4
      }
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]);
    }

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add signature page
    const signPage = pdfDoc.addPage([595, 420]);
    const { width, height } = signPage.getSize();

    // Background
    signPage.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.97, 0.97, 0.99) });

    // Header bar (blue)
    signPage.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: rgb(0.12, 0.46, 0.87) });
    signPage.drawText('COMPROVANTE DE ASSINATURA — FOLHA DE PONTO', {
      x: 30, y: height - 38, size: 14, font: helveticaBold, color: rgb(1, 1, 1)
    });

    // Employee info
    const infoY = height - 90;
    signPage.drawText('Funcionário:', { x: 30, y: infoY, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(employeeName, { x: 115, y: infoY, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('Competência:', { x: 30, y: infoY - 18, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(report.competence || '', { x: 115, y: infoY - 18, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    // Signature data section
    const sigInfoY = infoY - 65;
    signPage.drawText('DADOS DA ASSINATURA ELETRÔNICA', {
      x: 30, y: sigInfoY + 15, size: 11, font: helveticaBold, color: rgb(0.12, 0.46, 0.87)
    });
    signPage.drawLine({ start: { x: 30, y: sigInfoY + 10 }, end: { x: width - 30, y: sigInfoY + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.9) });

    const dataAssinatura = report.data_assinatura
      ? new Date(report.data_assinatura).toLocaleString('pt-BR', { timeZone: 'America/Manaus' })
      : 'N/A';

    signPage.drawText('Data/Hora:', { x: 30, y: sigInfoY - 5, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(dataAssinatura, { x: 115, y: sigInfoY - 5, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('IP:', { x: 30, y: sigInfoY - 23, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(report.ip_assinatura || 'N/A', { x: 115, y: sigInfoY - 23, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('GPS:', { x: 30, y: sigInfoY - 41, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(report.gps_assinatura || 'N/A', { x: 115, y: sigInfoY - 41, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('Dispositivo:', { x: 30, y: sigInfoY - 59, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    const ua = (report.user_agent_assinatura || 'N/A').substring(0, 60);
    signPage.drawText(ua, { x: 115, y: sigInfoY - 59, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    // Embed signature image
    if (report.assinatura_digital) {
      try {
        const base64Data = report.assinatura_digital.replace(/^data:image\/\w+;base64,/, '');
        const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const sigDims = sigImage.scaleToFit(200, 70);

        signPage.drawText('Assinatura:', { x: 30, y: sigInfoY - 85, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
        signPage.drawRectangle({ x: 115, y: sigInfoY - 90 - sigDims.height + 10, width: sigDims.width + 10, height: sigDims.height + 10, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
        signPage.drawImage(sigImage, {
          x: 120,
          y: sigInfoY - 85 - sigDims.height + 5,
          width: sigDims.width,
          height: sigDims.height
        });
      } catch {}
    }

    // Embed photo if exists
    if (report.foto_assinatura) {
      try {
        const photoResponse = await fetch(report.foto_assinatura);
        const photoBytes = await photoResponse.arrayBuffer();
        const photoImage = await pdfDoc.embedJpg(photoBytes);
        const photoDims = photoImage.scaleToFit(100, 100);

        signPage.drawText('Foto:', { x: width - 160, y: sigInfoY - 5, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
        signPage.drawRectangle({ x: width - 160, y: sigInfoY - 20 - photoDims.height, width: photoDims.width + 10, height: photoDims.height + 10, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
        signPage.drawImage(photoImage, {
          x: width - 155,
          y: sigInfoY - 15 - photoDims.height,
          width: photoDims.width,
          height: photoDims.height
        });
      } catch {}
    }

    // Footer
    signPage.drawRectangle({ x: 0, y: 0, width, height: 35, color: rgb(0.93, 0.93, 0.97) });
    signPage.drawText('Documento assinado eletronicamente. Assinatura, IP, GPS e foto são provas legais de aceite da folha de ponto.', {
      x: 30, y: 12, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5)
    });

    // Save
    const signedPdfBytes = await pdfDoc.save();
    const blob = new Blob([signedPdfBytes], { type: 'application/pdf' });
    const fileName = `folha_ponto_assinada_${(employeeName).replace(/\s+/g, '_')}_${(report.competence || '').replace('/', '-')}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    await base44.asServiceRole.entities.SignedTimeReport.update(report_id, {
      arquivo_pdf_assinado: file_url
    });

    return Response.json({ success: true, signed_pdf_url: file_url });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});