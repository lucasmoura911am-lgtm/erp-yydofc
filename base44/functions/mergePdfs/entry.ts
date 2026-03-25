import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf1_url, pdf2_url } = await req.json();
    if (!pdf1_url || !pdf2_url) return Response.json({ error: 'pdf1_url e pdf2_url são obrigatórios' }, { status: 400 });

    // Fetch both PDFs
    const [res1, res2] = await Promise.all([fetch(pdf1_url), fetch(pdf2_url)]);
    const [bytes1, bytes2] = await Promise.all([res1.arrayBuffer(), res2.arrayBuffer()]);

    // Merge
    const merged = await PDFDocument.create();
    const doc1 = await PDFDocument.load(bytes1);
    const doc2 = await PDFDocument.load(bytes2);

    const pages1 = await merged.copyPages(doc1, doc1.getPageIndices());
    pages1.forEach(p => merged.addPage(p));

    const pages2 = await merged.copyPages(doc2, doc2.getPageIndices());
    pages2.forEach(p => merged.addPage(p));

    const mergedBytes = await merged.save();

    // Upload merged PDF
    const formData = new FormData();
    formData.append('file', new Blob([mergedBytes], { type: 'application/pdf' }), 'documento_completo.pdf');

    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file: new Blob([mergedBytes], { type: 'application/pdf' }) });

    return Response.json({ file_url: uploaded.file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});