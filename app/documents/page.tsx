'use client';

import React, { useState, useEffect } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { fetchKnowledgeDocsFromDb, fetchDocumentChunksFromDb } from '@/lib/supabase/db';
import { DatabaseKnowledgeDocument, DatabaseDocumentChunk } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function DocumentsPage() {
  const { workspace } = useFinance();
  const [documents, setDocuments] = useState<DatabaseKnowledgeDocument[]>([]);
  const [chunks, setChunks] = useState<DatabaseDocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Doc Form
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('financial_context');
  const [source, setSource] = useState('Executive Overview');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDocs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [docsData, chunksData] = await Promise.all([
        fetchKnowledgeDocsFromDb(workspace.id),
        fetchDocumentChunksFromDb(workspace.id),
      ]);
      setDocuments(docsData);
      setChunks(chunksData);
    } catch (err) {
      console.warn('Error loading docs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    let ignore = false;
    async function startFetch() {
      if (!ignore) {
        await loadDocs();
      }
    }
    startFetch();
    return () => {
      ignore = true;
    };
  }, [loadDocs]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      // 1. Insert knowledge document
      const { data: docData, error: docErr } = await supabase
        .from('knowledge_documents')
        .insert({
          workspace_id: workspace.id,
          title: title.trim(),
          document_type: docType,
          source: source.trim() || 'Manual Input',
          content: content.trim(),
          metadata: {
            created_by: 'Founder',
            workspace_name: workspace.name,
          },
        })
        .select()
        .single();

      if (docErr || !docData) {
        throw docErr;
      }

      // 2. Insert chunk
      await supabase.from('document_chunks').insert({
        document_id: docData.id,
        workspace_id: workspace.id,
        chunk_index: 0,
        content: content.trim(),
        metadata: {
          title: title.trim(),
          source: source.trim(),
        },
      });

      // Reset
      setTitle('');
      setContent('');
      setIsModalOpen(false);
      await loadDocs();
    } catch (err) {
      console.error('Error adding knowledge document:', err);
      alert('Failed to save document. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
              RAG Knowledge Base
            </span>
            <span className="text-xs text-on-surface-variant font-medium">• Verified Ground Truth</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Corporate Context & Documents
          </h1>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed max-w-2xl">
            Semantic ground-truth documents used by the AI Co-Pilot to answer business and accounting questions for <strong className="text-on-surface">{workspace.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-2 shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add Knowledge Document</span>
          </button>
          <Link
            href="/ask-ai"
            className="px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-2 shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            <span>Query AI</span>
          </Link>
        </div>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <span className="material-symbols-outlined text-3xl animate-spin text-primary block mb-3 mx-auto">
            progress_activity
          </span>
          <span className="font-medium">Loading verified knowledge documents...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant text-center space-y-4 max-w-3xl mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px]">menu_book</span>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-on-surface">No Documents Stored for {workspace.name}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed max-w-lg mx-auto">
              Knowledge documents added to this workspace will automatically be indexed into semantic chunks for the AI Co-Pilot. Add your business model, pricing structure, or financial policies.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add First Knowledge Document</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          <div className="grid grid-cols-1 gap-4 w-full">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/70 space-y-3 shadow-sm w-full"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-xl">description</span>
                    <h3 className="font-bold text-sm text-on-surface">{doc.title}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-[11px] font-mono-data text-on-surface-variant font-medium">
                    {doc.document_type} • {doc.source}
                  </span>
                </div>

                <p className="text-xs text-on-surface/90 bg-surface-bright p-4 rounded-xl border border-outline-variant/40 leading-relaxed font-body-sm whitespace-pre-wrap">
                  {doc.content}
                </p>

                <div className="flex items-center gap-4 text-[11px] text-outline font-mono-data pt-1">
                  <span>Created: {new Date(doc.created_at).toLocaleDateString()}</span>
                  <span>Chunks: {chunks.filter((c) => c.document_id === doc.id).length}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Semantic Chunks Preview */}
          {chunks.length > 0 && (
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 space-y-4 w-full">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">token</span>
                  <span>Indexed Semantic Chunks ({chunks.length})</span>
                </h3>
                <span className="text-[11px] text-on-surface-variant font-mono-data">
                  Used by RAG Cosine Similarity Engine
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-3.5 bg-surface-bright rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant space-y-2"
                  >
                    <div className="flex justify-between items-center text-[10px] font-mono-data text-outline">
                      <span className="font-semibold text-primary">Chunk #{chunk.chunk_index + 1}</span>
                      <span>ID: {chunk.id.substring(0, 8)}...</span>
                    </div>
                    <p className="text-on-surface text-[12px] leading-relaxed line-clamp-4">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Knowledge Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl w-full max-w-[680px] p-6 sm:p-8 shadow-2xl space-y-5 text-on-surface">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-on-surface">Add Knowledge Document</h2>
                <p className="text-xs text-on-surface-variant">Ground AI Co-Pilot in your specific company context and accounting policies</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded-lg text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Financial Strategy & Unit Economics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="financial_context">Financial Context</option>
                    <option value="policy">Accounting Policy</option>
                    <option value="contracts">Vendor Contract</option>
                    <option value="forecast">Operating Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Source / Author
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Founder Overview"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Document Content / Text *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Paste or write context about your business, revenue models, key customer contracts, payroll details, and growth targets..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span>Saving & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Save & Index Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
