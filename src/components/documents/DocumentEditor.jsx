import React, { useRef } from "react";
import ReactQuill from "react-quill";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, false] }],
  [{ font: [] }],
  [{ size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["blockquote"],
  ["link", "image"],
  ["clean"],
];

export default function DocumentEditor({ value, onChange, onInsertVariable }) {
  const quillRef = useRef(null);

  const handleInsert = (variable) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection(true);
      editor.insertText(range.index, variable);
      editor.setSelection(range.index + variable.length);
    }
    if (onInsertVariable) onInsertVariable(variable);
  };

  // Expose handleInsert to parent
  React.useImperativeHandle(onInsertVariable, () => ({ handleInsert }));

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={{ toolbar: TOOLBAR_OPTIONS }}
        style={{ minHeight: "400px" }}
        placeholder="Digite o conteúdo do documento aqui... Use as variáveis do painel lateral para inserir dados dinâmicos."
      />
    </div>
  );
}

// Export insert helper to be used from outside
export function insertVariableIntoQuill(quillRef, variable) {
  const editor = quillRef?.current?.getEditor();
  if (editor) {
    const range = editor.getSelection(true);
    const idx = range ? range.index : editor.getLength();
    editor.insertText(idx, variable);
    editor.setSelection(idx + variable.length);
  }
}