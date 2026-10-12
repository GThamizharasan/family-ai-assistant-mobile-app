import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Phone,
  Sparkles,
  Volume2,
  CheckCheck,
  Check,
  Search,
  RefreshCw,
  QrCode,
  ShieldCheck,
  ExternalLink,
  Users,
  Briefcase,
  Heart,
  Clock,
  Mic,
  MicOff,
  ChevronRight,
  SlidersHorizontal,
  X,
  AlertCircle,
  Copy,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  WhatsAppContact,
  WhatsAppMessage,
} from '../../types';
import {
  createDirectWhatsAppUrl,
  generateAuraWhatsAppReply,
  speakWhatsAppMessage,
} from '../../services/whatsapp';
import { speechEngine } from '../../services/speech';

interface WhatsAppTabProps {
  initialContactId?: string;
  onOpenVoice?: () => void;
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({ initialContactId, onOpenVoice }) => {
  const {
    user,
    whatsAppConfig,
    whatsAppContacts,
    whatsAppMessages,
    sendWhatsAppMessage,
    markWhatsAppAsRead,
    updateWhatsAppConfig,
    refreshWhatsAppMessages,
  } = useApp();

  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialContactId || whatsAppContacts[0]?.id || 'wa-contact-selvapriya'
  );
  const [filterCategory, setFilterCategory] = useState<'all' | 'family' | 'business' | 'groups' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isGeneratingAuraReply, setIsGeneratingAuraReply] = useState(false);
  const [customAuraPrompt, setCustomAuraPrompt] = useState('');
  const [auraTone, setAuraTone] = useState<'warm, empathetic, and executive' | 'loving, affectionate family tone' | 'sharp, decisive venture partner tone' | 'quick confirmation'>('warm, empathetic, and executive');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiRationale, setAiRationale] = useState<string>('');
  const [aiRecommendedAction, setAiRecommendedAction] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedContact = whatsAppContacts.find((c) => c.id === selectedContactId) || whatsAppContacts[0];

  const conversationMessages = whatsAppMessages.filter(
    (m) => m.contactId === selectedContact?.id
  );

  const latestIncomingMessage = [...conversationMessages]
    .reverse()
    .find((m) => !m.isOutgoing) || conversationMessages[conversationMessages.length - 1];

  // Auto-scroll to end of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length, selectedContactId]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (selectedContactId) {
      markWhatsAppAsRead(selectedContactId);
      // Pre-populate Auro smart replies for the latest incoming message
      if (latestIncomingMessage && whatsAppConfig.autoDraftWithAura) {
        handleTriggerAuraDraft(latestIncomingMessage);
      }
    }
  }, [selectedContactId]);

  // Trigger Auro AI Draft Generation
  const handleTriggerAuraDraft = async (msg: WhatsAppMessage, toneOverride?: string) => {
    setIsGeneratingAuraReply(true);
    try {
      const result = await generateAuraWhatsAppReply(
        msg,
        { name: user.name, email: user.email },
        toneOverride || auraTone
      );
      setAiSuggestions(result.suggestedReplies || []);
      setAiRationale(result.rationale || '');
      setAiRecommendedAction(result.recommendedAction || '');
    } catch (err) {
      console.warn('Auro AI draft error:', err);
    } finally {
      setIsGeneratingAuraReply(false);
    }
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !selectedContact) return;

    sendWhatsAppMessage(selectedContact.id, replyText);
    showToast(`Message sent to ${selectedContact.name}`);
    setReplyText('');
    setAiSuggestions([]);
    setAiRationale('');
  };

  const handleSelectSuggestedReply = (suggestion: string) => {
    setReplyText(suggestion);
  };

  const handleSendSuggestedReplyInstantly = (suggestion: string) => {
    if (!selectedContact) return;
    sendWhatsAppMessage(selectedContact.id, suggestion);
    showToast(`Auro reply sent to ${selectedContact.name}`);
    setReplyText('');
    setAiSuggestions([]);
    setAiRationale('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSpeakAloud = (msg: WhatsAppMessage) => {
    speakWhatsAppMessage(msg.contactName, msg.text);
    showToast(`Auro reading message aloud...`);
  };

  const handleVoiceDictation = async () => {
    if (isDictating) {
      speechEngine.stopListening();
      setIsDictating(false);
    } else {
      const allowed = await speechEngine.requestMicPermission();
      if (!allowed) {
        showToast('Please enable microphone access in browser.');
        return;
      }
      setIsDictating(true);
      speechEngine.onTranscriptCallback = (transcript, isFinal) => {
        setReplyText(transcript);
        if (isFinal) {
          setIsDictating(false);
          speechEngine.stopListening();
        }
      };
      speechEngine.startListening();
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await refreshWhatsAppMessages();
    setTimeout(() => {
      setIsSyncing(false);
      showToast('WhatsApp messages synchronized with web bridge.');
    }, 700);
  };

  // Filter contacts
  const filteredContacts = whatsAppContacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.lastMessagePreview && contact.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase())) ||
      contact.phone.includes(searchQuery);

    if (!matchesSearch) return false;

    if (filterCategory === 'all') return true;
    if (filterCategory === 'unread') return contact.unreadCount > 0;
    return contact.category === filterCategory;
  });

  const totalUnread = whatsAppContacts.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-4 pb-28 pt-2">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg shadow-emerald-900/50 flex items-center gap-2 animate-bounce">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card: Connected Account & Auro Assistant Status */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">WhatsApp Account Hub</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{whatsAppConfig.accountName}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-400/90">{whatsAppConfig.linkedPhone}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700/60"
              title="Sync latest WhatsApp messages"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Messages'}</span>
            </button>

            <button
              onClick={() => setShowPairingModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700/60"
              title="View WhatsApp Web Pairing Code"
            >
              <QrCode className="w-3.5 h-3.5 text-teal-400" />
              <span>QR / Bridge</span>
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
              title="Configure WhatsApp & Auro Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auro Assistant Integration Pill Bar */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>
              <strong>Auro Assistant:</strong> Context-aware empathetic AI replies & voice synthesis active.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold">
                {totalUnread} Unread
              </span>
            )}
            <span className="text-[11px] text-slate-400">{whatsAppConfig.pairedAt}</span>
          </div>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search WhatsApp messages, contacts, phone numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'all'
                ? 'bg-emerald-500 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Messages ({whatsAppContacts.length})
          </button>
          <button
            onClick={() => setFilterCategory('unread')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'unread'
                ? 'bg-rose-500 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Unread</span>
            {totalUnread > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600/60 text-white text-[10px]">
                {totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterCategory('family')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'family'
                ? 'bg-emerald-500 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Heart className="w-3 h-3 text-rose-400" />
            <span>Family (Spouse & Son)</span>
          </button>
          <button
            onClick={() => setFilterCategory('business')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'business'
                ? 'bg-emerald-500 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Briefcase className="w-3 h-3 text-amber-400" />
            <span>Business & Partners</span>
          </button>
          <button
            onClick={() => setFilterCategory('groups')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'groups'
                ? 'bg-emerald-500 text-white font-semibold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3 h-3 text-indigo-400" />
            <span>Family Circles</span>
          </button>
        </div>
      </div>

      {/* Main Two-Section View: Contacts / Latest Messages List + Active Conversation */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Contacts & Latest Message List (Left or Mobile Top) */}
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Latest WhatsApp Conversations
            </span>
            <span className="text-[11px] text-slate-500">{filteredContacts.length} Threads</span>
          </div>

          <div className="space-y-1.5 max-h-[500px] md:max-h-[640px] overflow-y-auto pr-0.5">
            {filteredContacts.map((contact) => {
              const isSelected = contact.id === selectedContact?.id;
              const contactMsgs = whatsAppMessages.filter((m) => m.contactId === contact.id);
              const lastMsg = contactMsgs[contactMsgs.length - 1];

              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                      : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-700"
                      />
                      {contact.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {contact.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {contact.lastMessageTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {contact.relationship}
                        </span>
                        {contact.category === 'business' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Business
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1">
                        {lastMsg ? (
                          <>
                            {lastMsg.isOutgoing && <span className="text-emerald-400 mr-1">You:</span>}
                            {lastMsg.text}
                          </>
                        ) : (
                          contact.lastMessagePreview
                        )}
                      </p>
                    </div>

                    {contact.unreadCount > 0 && (
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
                          {contact.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick Action Drawer for Card */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactId(contact.id);
                        if (lastMsg && !lastMsg.isOutgoing) {
                          handleTriggerAuraDraft(lastMsg);
                        }
                      }}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auro Draft</span>
                    </button>

                    {lastMsg && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakAloud(lastMsg);
                        }}
                        className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Listen</span>
                      </button>
                    )}

                    <a
                      href={createDirectWhatsAppUrl(contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>WhatsApp Web</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Conversation & Auro AI Reply Studio (Right or Mobile Bottom) */}
        <div className="md:col-span-7 flex flex-col rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
          {/* Active Contact Header */}
          <div className="p-3.5 sm:p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  className="w-10 h-10 rounded-2xl object-cover border border-slate-700"
                />
                {selectedContact.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <span>{selectedContact.name}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    ({selectedContact.relationship})
                  </span>
                </h3>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span>{selectedContact.isOnline ? 'Active on WhatsApp Web' : selectedContact.lastMessageTime}</span>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-slate-400">{selectedContact.phone}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={createDirectWhatsAppUrl(selectedContact.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Launch in WhatsApp Web / App"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
              </a>

              {latestIncomingMessage && (
                <button
                  onClick={() => handleSpeakAloud(latestIncomingMessage)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Read latest message aloud via Auro Assistant"
                >
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[380px] bg-slate-950/30">
            {conversationMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isOutgoing ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl relative shadow-sm ${
                    msg.isOutgoing
                      ? 'bg-emerald-600/90 text-white rounded-tr-none'
                      : 'bg-slate-800/95 text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  {!msg.isOutgoing && (
                    <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-emerald-400 font-semibold">
                      <span>{msg.contactName}</span>
                      {msg.urgency === 'urgent' && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] uppercase tracking-wider font-bold">
                          Urgent
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                  <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] text-slate-300/80">
                    <span>{msg.timestamp}</span>
                    {msg.isOutgoing && (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                    )}
                  </div>
                </div>

                {/* Quick action bar for incoming message */}
                {!msg.isOutgoing && (
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                    <button
                      onClick={() => handleTriggerAuraDraft(msg)}
                      className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                      <span>Draft reply with Auro</span>
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => handleSpeakAloud(msg)}
                      className="hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <Volume2 className="w-2.5 h-2.5" />
                      <span>Speak</span>
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className="hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Auro Assistant AI Reply Studio Box */}
          <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-3">
            {/* Auro Header with Tone Picker */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <span className="text-xs font-bold text-white">Auro AI Reply Studio</span>
                {isGeneratingAuraReply && (
                  <span className="text-[10px] text-indigo-400 animate-pulse">
                    Crafting intelligent reply...
                  </span>
                )}
              </div>

              {/* Tone Selection */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => {
                    const newTone = 'loving, affectionate family tone';
                    setAuraTone(newTone);
                    if (latestIncomingMessage) handleTriggerAuraDraft(latestIncomingMessage, newTone);
                  }}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    auraTone.includes('family')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Family
                </button>
                <button
                  onClick={() => {
                    const newTone = 'sharp, decisive venture partner tone';
                    setAuraTone(newTone);
                    if (latestIncomingMessage) handleTriggerAuraDraft(latestIncomingMessage, newTone);
                  }}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    auraTone.includes('venture')
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Executive
                </button>
                <button
                  onClick={() => {
                    const newTone = 'warm, empathetic, and executive';
                    setAuraTone(newTone);
                    if (latestIncomingMessage) handleTriggerAuraDraft(latestIncomingMessage, newTone);
                  }}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    auraTone === 'warm, empathetic, and executive'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Balanced
                </button>
              </div>
            </div>

            {/* Auro Suggested Replies Carousel / Chips */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 p-2.5 rounded-2xl bg-slate-950/60 border border-indigo-500/20">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-indigo-300 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Recommended Auro AI Replies:
                  </span>
                  <span className="text-slate-400 text-[10px]">Tap to send or edit</span>
                </div>

                <div className="space-y-1.5">
                  {aiSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="group p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/40 text-xs text-slate-200 flex items-start justify-between gap-2 transition-all cursor-pointer"
                      onClick={() => handleSelectSuggestedReply(suggestion)}
                    >
                      <span className="flex-1 leading-snug">{suggestion}</span>
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendSuggestedReplyInstantly(suggestion);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] flex items-center gap-1 shadow"
                          title="Send immediately via WhatsApp"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Rationale & Recommended Follow-up */}
                {(aiRationale || aiRecommendedAction) && (
                  <div className="pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-0.5">
                    {aiRationale && (
                      <p>
                        <strong className="text-slate-300">Auro Context:</strong> {aiRationale}
                      </p>
                    )}
                    {aiRecommendedAction && (
                      <p className="text-emerald-400/90 font-medium">
                        <strong>Suggested Follow-up:</strong> {aiRecommendedAction}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Auro Prompt Bar */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Ask Auro to draft a specific response (e.g. 'Agree to 8:30 PM and bring dessert')..."
                value={customAuraPrompt}
                onChange={(e) => setCustomAuraPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customAuraPrompt.trim() && latestIncomingMessage) {
                    e.preventDefault();
                    handleTriggerAuraDraft(latestIncomingMessage, `custom prompt: ${customAuraPrompt}`);
                    setCustomAuraPrompt('');
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (customAuraPrompt.trim() && latestIncomingMessage) {
                    handleTriggerAuraDraft(latestIncomingMessage, `custom prompt: ${customAuraPrompt}`);
                    setCustomAuraPrompt('');
                  }
                }}
                disabled={!customAuraPrompt.trim() || isGeneratingAuraReply}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Draft</span>
              </button>
            </div>

            {/* Main Composition Box */}
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative">
                <textarea
                  rows={2}
                  placeholder={`Reply to ${selectedContact.name} via Auro...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                />

                <div className="absolute right-2.5 bottom-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleVoiceDictation}
                    className={`p-1.5 rounded-xl transition-colors ${
                      isDictating
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={isDictating ? 'Stop dictation' : 'Dictate reply with voice'}
                  >
                    {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <a
                    href={createDirectWhatsAppUrl(selectedContact.phone, replyText || undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700 transition-colors"
                    title="Launch WhatsApp Web with prefilled message"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (latestIncomingMessage) {
                        handleTriggerAuraDraft(latestIncomingMessage);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 border border-indigo-500/30 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Re-draft with Auro</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* QR / Bridge Pairing Modal */}
      {showPairingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowPairingModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">WhatsApp Web Bridge</h3>
              <p className="text-xs text-slate-400">
                Synchronized with Thamiz’s primary WhatsApp account via local sovereign encryption.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-3">
              {/* Simulated QR Pattern */}
              <div className="w-44 h-44 bg-white p-3 rounded-2xl flex flex-col items-center justify-center relative shadow-inner">
                <div className="w-full h-full border-4 border-slate-900 border-dashed rounded-xl flex flex-col items-center justify-center p-2 text-center text-slate-900 font-mono text-[10px]">
                  <MessageSquare className="w-8 h-8 text-emerald-600 mb-1" />
                  <span className="font-bold text-xs">AURA-WHATSAPP</span>
                  <span>{whatsAppConfig.pairingCode}</span>
                  <span className="text-[8px] text-slate-500 mt-1">Sovereign Bridge</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-slate-400">Pairing Code:</span>
                <p className="font-mono text-sm font-bold text-emerald-400 tracking-wider">
                  {whatsAppConfig.pairingCode}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="font-medium">Active Bridge Status: Connected & Encrypted</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Open WhatsApp on your phone &gt; Linked Devices &gt; Link a Device to verify your
                synchronization state.
              </p>
            </div>

            <button
              onClick={() => {
                setShowPairingModal(false);
                showToast('Bridge synchronization re-verified.');
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
            >
              Done & Return
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white">WhatsApp & Auro Preferences</h3>
              <p className="text-xs text-slate-400">
                Configure phone linkage, auto-drafting, and speech parameters.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Primary WhatsApp Phone Number
                </label>
                <input
                  type="text"
                  value={whatsAppConfig.linkedPhone}
                  onChange={(e) => updateWhatsAppConfig({ linkedPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Account Label
                </label>
                <input
                  type="text"
                  value={whatsAppConfig.accountName}
                  onChange={(e) => updateWhatsAppConfig({ accountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Auto-draft replies with Auro Assistant</span>
                  <input
                    type="checkbox"
                    checked={whatsAppConfig.autoDraftWithAura}
                    onChange={(e) => updateWhatsAppConfig({ autoDraftWithAura: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Allow Auro to read incoming messages aloud</span>
                  <input
                    type="checkbox"
                    checked={whatsAppConfig.autoVoiceRead}
                    onChange={(e) => updateWhatsAppConfig({ autoVoiceRead: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={() => {
                setShowConfigModal(false);
                showToast('Settings saved successfully.');
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
