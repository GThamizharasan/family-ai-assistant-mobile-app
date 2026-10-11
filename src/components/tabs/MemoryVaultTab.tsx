import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Search,
  Plus,
  Key,
  Unlock,
  Trash2,
  FileLock2,
  Share2,
  Sparkles,
  Link2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EncryptedVaultNote } from '../../types';

export const MemoryVaultTab: React.FC = () => {
  const { vaultNotes, addVaultNote, decryptVaultNote, deleteVaultNote, syncStatus } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<EncryptedVaultNote['category']>('Strategic IP');

  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [decryptingId, setDecryptingId] = useState<string | null>(null);

  const filteredNotes = vaultNotes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.plainSummary.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    );
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    await addVaultNote(noteTitle.trim(), noteContent.trim(), noteCategory);
    setNoteTitle('');
    setNoteContent('');
    setShowAddModal(false);
  };

  const handleToggleDecrypt = async (note: EncryptedVaultNote) => {
    if (decryptedMap[note.id]) {
      // Re-lock
      setDecryptedMap((prev) => {
        const copy = { ...prev };
        delete copy[note.id];
        return copy;
      });
      return;
    }

    setDecryptingId(note.id);
    const plain = await decryptVaultNote(note);
    setDecryptedMap((prev) => ({ ...prev, [note.id]: plain }));
    setDecryptingId(null);
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Vault Header */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Client-Encrypted Memory Vault</h2>
            <p className="text-xs text-slate-400">
              AES-256-GCM Zero-Knowledge Encryption • Sync: <span className="text-emerald-400 capitalize">{syncStatus}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-md shadow-emerald-600/30"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Encrypt New Secret</span>
        </button>
      </div>

      {/* Semantic Memory Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search past notes, linked memories & personal preferences..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
        />
      </div>

      {/* Encrypted Notes Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1 text-slate-400">
          <span>Encrypted Records ({filteredNotes.length})</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hardware Enclave Protected</span>
          </span>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
            No memories matching query. All data remains encrypted on this device.
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isDecrypted = !!decryptedMap[note.id];
            const isProcessing = decryptingId === note.id;

            return (
              <div
                key={note.id}
                className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileLock2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="font-bold text-white text-sm">{note.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {note.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDecrypt(note)}
                      disabled={isProcessing}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        isDecrypted
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                      }`}
                    >
                      {isDecrypted ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span>{isProcessing ? 'Decrypting...' : isDecrypted ? 'Lock Cipher' : 'Decrypt with Passkey'}</span>
                    </button>

                    <button
                      onClick={() => deleteVaultNote(note.id)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content: Decrypted plaintext or Ciphertext badge */}
                {isDecrypted ? (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 text-xs text-slate-100 leading-relaxed font-mono whitespace-pre-wrap animate-fade-in">
                    {decryptedMap[note.id]}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between overflow-hidden">
                    <span className="truncate">Ciphertext: {note.encryptedPayload.slice(0, 48)}...</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-400 text-[9px] shrink-0 ml-2">
                      AES-256-GCM
                    </span>
                  </div>
                )}

                {/* Contextual Memory Links Graph */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                  <Link2 className="w-3 h-3 text-indigo-400" />
                  <span>Linked Memories:</span>
                  {note.linkedMemories.map((lm, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                      {lm}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Add Vault Note */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Encrypt Secret into Memory Vault</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Delaware Holding Operating Agreement"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Category</label>
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Strategic IP">Strategic IP</option>
                  <option value="Financial Keys">Financial Keys</option>
                  <option value="Family Wills & Health">Family Wills & Health</option>
                  <option value="Personal Reflections">Personal Reflections</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Secret Content (Encrypted client-side)</label>
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Sensitive seed phrases, trust distribution percentages, confidential deal metrics..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
                >
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
