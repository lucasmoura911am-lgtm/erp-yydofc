import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Loader2,
  Users, ArrowLeft, Zap, Info
} from "lucide-react";
import { Link } from "react-router-dom";

export default function SmartPayslipsUpload() {
  const [user, setUser] = React.useState(null);
  const [file, setFile] = useState(null);
  const [competencia, setCompetencia] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !competencia || !user?.company_id) return;
    setError(null);
    setResult(null);

    // Step 1: Upload PDF
    setUploading(true);
    let pdf_url;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      pdf_url = file_url;
    } catch (err) {
      setError("Erro ao fazer upload do PDF: " + err.message);
      setUploading(false);
      return;
    }
    setUploading(false);

    // Step 2: Process batch
    setProcessing(true);
    try {
      const res = await base44.functions.invoke("processPayslipBatch", {
        pdf_url,
        competencia,
        company_id: user.company_id
      });
      setResult(res.data || res);
    } catch (err) {
      setError("Erro ao processar holerites: " + (err.response?.data?.error || err.message));
    }
    setProcessing(false);
  };

  const isLoading = uploading || processing;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/SmartPayslipsDashboard">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Upload de Holerites em Lote</h1>
          <p className="text-gray-500 text-sm mt-0.5">Envie um PDF geral — a IA identificará cada funcionário automaticamente</p>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
        <Zap className="w-4 h-4 text-purple-600" />
        <AlertDescription className="text-purple-800 dark:text-purple-300 text-sm">
          <strong>Como funciona:</strong> Faça upload de um PDF contendo holerites de vários funcionários.
          A IA irá ler, identificar cada funcionário pelo nome e matrícula, e criar registros individuais automaticamente.
        </AlertDescription>
      </Alert>

      {/* Form */}
      {!result && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-purple-600" />Enviar Arquivo</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Competência *</Label>
                <Input
                  placeholder="Ex: 03/2026"
                  value={competencia}
                  onChange={e => setCompetencia(e.target.value)}
                  pattern="(0[1-9]|1[0-2])\/[0-9]{4}"
                  required
                />
                <p className="text-xs text-gray-500">Formato MM/AAAA — será usado como competência padrão</p>
              </div>

              <div className="space-y-2">
                <Label>Arquivo PDF *</Label>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    dragOver ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-gray-300 hover:border-purple-400"
                  } ${file ? "border-green-400 bg-green-50 dark:bg-green-900/20" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => document.getElementById("pdf-upload").click()}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <p className="font-semibold text-green-700 dark:text-green-300">{file.name}</p>
                        <p className="text-xs text-green-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="font-medium text-gray-600 dark:text-gray-400">Arraste o PDF aqui ou clique para selecionar</p>
                      <p className="text-xs text-gray-400 mt-1">Apenas arquivos PDF</p>
                    </>
                  )}
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => setFile(e.target.files[0])}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={!file || !competencia || isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white h-12 text-base"
              >
                {uploading && <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Fazendo upload do PDF...</>}
                {processing && <><Loader2 className="w-5 h-5 mr-2 animate-spin" />IA processando holerites...</>}
                {!isLoading && <><Zap className="w-5 h-5 mr-2" />Processar com IA</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-200 dark:border-green-700">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Processamento Concluído!</h2>
              <p className="text-gray-500 text-sm mt-1">Lote ID: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{result.batch_id}</code></p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{result.total_encontrados || 0}</p>
                <p className="text-xs text-blue-600 mt-0.5">Funcionários encontrados</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{result.total_vinculados || 0}</p>
                <p className="text-xs text-green-600 mt-0.5">Vinculados</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <p className="text-2xl font-bold text-yellow-600">{result.total_nao_vinculados || 0}</p>
                <p className="text-xs text-yellow-600 mt-0.5">Sem cadastro</p>
              </div>
            </div>

            {result.nao_vinculados?.length > 0 && (
              <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 mb-4">
                <Info className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-300 text-sm">
                  <strong>Não vinculados:</strong> {result.nao_vinculados.join(", ")}
                  <br />Verifique se esses funcionários estão cadastrados no sistema.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setFile(null); setCompetencia(""); }}>
                Novo Upload
              </Button>
              <Link to="/SmartPayslipsDashboard" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600">
                  <Users className="w-4 h-4 mr-2" />Ver Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}