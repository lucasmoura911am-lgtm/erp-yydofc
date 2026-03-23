import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import SignatureCanvas from "@/components/payslips/SignatureCanvas";
import { CheckCircle, Paperclip, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ActionConclusionModal({ action, open, onClose, onSaved }) {
  const [step, setStep] = useState("form"); // "form" | "signature"
  const [obs, setObs] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEvidenceFile(file);
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEvidenceUrl(file_url);
      toast.success("Evidência enviada!");
    } catch {
      toast.error("Erro ao enviar evidência.");
    }
    setUploading(false);
  };

  const handleSignatureSave = (dataUrl) => {
    setAssinaturaDataUrl(dataUrl);
    setStep("form");
  };

  const handleSave = async () => {
    if (!assinaturaDataUrl) {
      toast.error("Assinatura digital obrigatória para concluir.");
      return;
    }
    setSaving(true);
    try {
      // Upload da assinatura como imagem
      const blob = await (await fetch(assinaturaDataUrl)).blob();
      const sigFile = new File([blob], "assinatura.png", { type: "image/png" });
      const { file_url: sigUrl } = await base44.integrations.Core.UploadFile({ file: sigFile });

      // IP do cliente (best-effort)
      let ip = "";
      try { const r = await fetch("https://api.ipify.org?format=json"); const j = await r.json(); ip = j.ip; } catch {}

      await base44.entities.RiskActionPlan.update(action.id, {
        status: "concluido",
        completion_date: new Date().toISOString().split("T")[0],
        conclusao_observacao: obs,
        evidence_url: evidenceUrl || "",
        evidence_type: evidenceFile ? (evidenceFile.type.startsWith("image") ? "foto" : "pdf") : "",
        assinatura_url: sigUrl,
        assinatura_nome: action.responsible || "",
        assinatura_ip: ip,
        assinatura_data: new Date().toISOString(),
      });

      toast.success("Ação concluída com assinatura digital!");
      onSaved();
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar: " + err.message);
    }
    setSaving(false);
  };

  const reset = () => {
    setStep("form");
    setObs("");
    setEvidenceFile(null);
    setEvidenceUrl("");
    setAssinaturaDataUrl("");
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Concluir Ação com Evidência
          </DialogTitle>
        </DialogHeader>

        {step === "signature" ? (
          <SignatureCanvas
            onSave={handleSignatureSave}
            onCancel={() => setStep("form")}
          />
        ) : (
          <div className="space-y-5">
            {/* Ação */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-800">{action?.action_description}</p>
              <p className="text-gray-500 text-xs mt-1">Responsável: {action?.responsible}</p>
            </div>

            {/* Observação */}
            <div>
              <Label>Observação de conclusão</Label>
              <Textarea
                placeholder="Descreva o que foi realizado..."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
              />
            </div>

            {/* Evidência */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <Paperclip className="w-4 h-4" /> Evidência (foto ou PDF)
              </Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {uploading && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Enviando...</p>}
              {evidenceUrl && !uploading && (
                <p className="text-xs text-green-600 mt-1">✓ Evidência anexada</p>
              )}
            </div>

            {/* Assinatura */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <PenLine className="w-4 h-4" /> Assinatura Digital *
              </Label>
              {assinaturaDataUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img src={assinaturaDataUrl} alt="Assinatura" className="w-full h-20 object-contain" />
                  <div className="p-2 flex justify-between items-center text-xs text-gray-500 border-t">
                    <span>Assinatura capturada</span>
                    <button onClick={() => setAssinaturaDataUrl("")} className="text-red-500 hover:underline">Refazer</button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2" onClick={() => setStep("signature")}>
                  <PenLine className="w-4 h-4" /> Assinar Digitalmente
                </Button>
              )}
              {!assinaturaDataUrl && (
                <p className="text-xs text-red-500 mt-1">Assinatura obrigatória para concluir</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button
                disabled={saving || uploading || !assinaturaDataUrl}
                onClick={handleSave}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmar Conclusão
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}