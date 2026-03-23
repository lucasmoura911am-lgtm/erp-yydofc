import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payslip_id } = await req.json();
    if (!payslip_id) return Response.json({ error: 'payslip_id obrigatório' }, { status: 400 });

    // Load payslip
    const payslips = await base44.asServiceRole.entities.SmartPayslip.filter({ id: payslip_id });
    if (!payslips.length) return Response.json({ error: 'Holerite não encontrado' }, { status: 404 });
    const payslip = payslips[0];

    if (payslip.status_assinado !== 'assinado') {
      return Response.json({ error: 'Holerite ainda não assinado' }, { status: 400 });
    }

    // Download original PDF
    const pdfResponse = await fetch(payslip.arquivo_pdf_individual);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a new signature page at the end
    const signPage = pdfDoc.addPage([595, 420]); // A4 landscape-ish
    const { width, height } = signPage.getSize();

    // Background
    signPage.drawRectangle({
      x: 0, y: 0, width, height,
      color: rgb(0.97, 0.97, 0.99)
    });

    // Header bar
    signPage.drawRectangle({
      x: 0, y: height - 60, width, height: 60,
      color: rgb(0.38, 0.19, 0.65) // purple
    });

    signPage.drawText('COMPROVANTE DE ASSINATURA DIGITAL', {
      x: 30, y: height - 38,
      size: 16, font: helveticaBold, color: rgb(1, 1, 1)
    });

    // Employee info section
    const infoY = height - 90;
    signPage.drawText('Funcionário:', { x: 30, y: infoY, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(payslip.employee_name || '', { x: 110, y: infoY, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('Competência:', { x: 30, y: infoY - 18, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(payslip.competencia || '', { x: 110, y: infoY - 18, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('Matrícula:', { x: 30, y: infoY - 36, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(payslip.employee_code || 'N/A', { x: 110, y: infoY - 36, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    // Signature data section
    const sigInfoY = infoY - 70;
    signPage.drawText('DADOS DA ASSINATURA ELETRÔNICA', {
      x: 30, y: sigInfoY + 15,
      size: 11, font: helveticaBold, color: rgb(0.38, 0.19, 0.65)
    });
    signPage.drawLine({ start: { x: 30, y: sigInfoY + 10 }, end: { x: width - 30, y: sigInfoY + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.9) });

    const dataAssinatura = payslip.data_assinatura
      ? new Date(payslip.data_assinatura).toLocaleString('pt-BR', { timeZone: 'America/Manaus' })
      : 'N/A';

    signPage.drawText('Data/Hora:', { x: 30, y: sigInfoY - 5, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(dataAssinatura, { x: 110, y: sigInfoY - 5, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('IP:', { x: 30, y: sigInfoY - 23, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    signPage.drawText(payslip.ip_assinatura || 'N/A', { x: 110, y: sigInfoY - 23, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });

    signPage.drawText('Dispositivo:', { x: 30, y: sigInfoY - 41, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    const ua = (payslip.user_agent_assinatura || 'N/A').substring(0, 60);
    signPage.drawText(ua, { x: 110, y: sigInfoY - 41, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    // Embed signature image
    if (payslip.assinatura_digital) {
      try {
        // assinatura_digital is base64 PNG data URL
        const base64Data = payslip.assinatura_digital.replace(/^data:image\/\w+;base64,/, '');
        const sigBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const sigDims = sigImage.scaleToFit(200, 70);

        signPage.drawText('Assinatura:', { x: 30, y: sigInfoY - 70, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
        signPage.drawRectangle({ x: 110, y: sigInfoY - 75 - sigDims.height + 10, width: sigDims.width + 10, height: sigDims.height + 10, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
        signPage.drawImage(sigImage, {
          x: 115,
          y: sigInfoY - 70 - sigDims.height + 5,
          width: sigDims.width,
          height: sigDims.height
        });
      } catch (sigErr) {
        signPage.drawText('(assinatura não disponível)', { x: 110, y: sigInfoY - 75, size: 9, font: helvetica, color: rgb(0.6, 0.6, 0.6) });
      }
    }

    // Embed photo if exists
    if (payslip.foto_assinatura) {
      try {
        const photoResponse = await fetch(payslip.foto_assinatura);
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
    signPage.drawText('Este documento foi assinado eletronicamente. A assinatura, IP e foto são provas legais de aceite.', {
      x: 30, y: 12, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5)
    });

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const blob = new Blob([signedPdfBytes], { type: 'application/pdf' });
    const fileName = `holerite_assinado_${(payslip.employee_name || 'func').replace(/\s+/g, '_')}_${(payslip.competencia || '').replace('/', '-')}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Update payslip with signed PDF url
    await base44.asServiceRole.entities.SmartPayslip.update(payslip_id, {
      arquivo_pdf_assinado: file_url
    });

    return Response.json({ success: true, signed_pdf_url: file_url });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});