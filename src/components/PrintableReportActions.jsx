import { Eye, FileText, Printer } from 'lucide-react';

export default function PrintableReportActions({ busy, disabled, onAction }) {
  return <div className="flex flex-wrap gap-2">
    <button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => onAction('preview')}><Eye className="h-4 w-4" />Pré-visualizar</button>
    <button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => onAction('print')}><Printer className="h-4 w-4" />Imprimir</button>
    <button type="button" className="primary-button" disabled={busy || disabled} onClick={() => onAction('pdf')}><FileText className="h-4 w-4" />Salvar em PDF</button>
  </div>;
}
