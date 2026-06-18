import { Download, Eye, Pencil, Send, Trash2 } from 'lucide-react';
import { shortDate } from '../utils/formatters.js';
import StatusBadge from './StatusBadge.jsx';

export default function DocumentList({ documents = [], isAdmin, isRH, onDownload, onDelete, onRequestDelete, onEdit }) {
  if (!documents.length) return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">Sem dados para exibir.</div>;
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {documents.map((document) => <DocumentCard key={document.id} document={document} isAdmin={isAdmin} isRH={isRH} onDownload={onDownload} onDelete={onDelete} onRequestDelete={onRequestDelete} onEdit={onEdit} />)}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Vínculo</th><th className="px-4 py-3">Enviado por</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{documents.map((document) => <tr key={document.id} className="hover:bg-blue-50/40"><td className="px-4 py-3"><p className="font-black text-luvig-ink">{document.title}</p><p className="text-xs font-bold text-luvig-blue">{document.type}</p></td><td className="px-4 py-3 font-semibold text-slate-600">{document.employeeName || document.clientName || 'Administrativo'}</td><td className="px-4 py-3 font-semibold text-slate-600">{document.uploadedByName}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{shortDate(document.createdAt)}</td><td className="px-4 py-3"><StatusBadge status={document.status} /></td><td className="px-4 py-3"><Actions document={document} isAdmin={isAdmin} isRH={isRH} onDownload={onDownload} onDelete={onDelete} onRequestDelete={onRequestDelete} onEdit={onEdit} /></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function DocumentCard({ document, ...actions }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-luvig-ink">{document.title}</p><p className="mt-1 text-xs font-bold text-luvig-blue">{document.type}</p></div><StatusBadge status={document.status} /></div><div className="mt-3 space-y-1 text-xs font-semibold text-slate-500"><p>{document.employeeName || document.clientName || 'Administrativo'}</p><p>{shortDate(document.createdAt)} · {document.uploadedByName}</p></div><div className="mt-4"><Actions document={document} {...actions} /></div></article>;
}

function Actions({ document, isAdmin, isRH, onDownload, onDelete, onRequestDelete, onEdit }) {
  return <div className="flex flex-wrap justify-end gap-2"><a className="quiet-button min-h-9 px-3 py-1.5" href={document.viewUrl || '#'} target="_blank" rel="noreferrer" aria-disabled={!document.viewUrl}><Eye className="h-4 w-4" />Visualizar</a><button className="quiet-button min-h-9 px-3 py-1.5" type="button" onClick={() => onDownload?.(document)}><Download className="h-4 w-4" />Baixar</button>{isAdmin && <><button className="quiet-button min-h-9 px-3 py-1.5" type="button" onClick={() => onEdit?.(document)}><Pencil className="h-4 w-4" />Editar</button><button className="quiet-button min-h-9 px-3 py-1.5 text-red-600" type="button" onClick={() => onDelete?.(document)}><Trash2 className="h-4 w-4" />Excluir</button></>}{isRH && <button className="quiet-button min-h-9 px-3 py-1.5" type="button" onClick={() => onRequestDelete?.(document)}><Send className="h-4 w-4" />Solicitar exclusão</button>}</div>;
}
