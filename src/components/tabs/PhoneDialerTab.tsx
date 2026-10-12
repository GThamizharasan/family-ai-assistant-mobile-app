import React, { useState, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneForwarded,
  UserPlus,
  Search,
  Star,
  Clock,
  Grid,
  Users,
  Delete,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  Upload,
  Download,
  AlertCircle,
  FileText,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PhoneContact, CallLogItem } from '../../types';
import {
  playDtmfTone,
  makeNativeDirectCall,
  isDeviceContactPickerSupported,
  parseVCardContent,
} from '../../services/phoneService';

export const PhoneDialerTab: React.FC = () => {
  const {
    phoneContacts,
    callLogs,
    startCall,
    importDeviceContacts,
    addPhoneContact,
    deletePhoneContact,
    toggleContactFavorite,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'dialpad' | 'contacts' | 'recents'>('dialpad');
  const [dialedNumber, setDialedNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'favorites' | 'family' | 'business' | 'device'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<CallLogItem | null>(null);

  // New Contact Form State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelationship, setNewContactRelationship] = useState('');
  const [newContactCategory, setNewContactCategory] = useState<PhoneContact['category']>('family');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleKeyPress = (char: string) => {
    playDtmfTone(char);
    setDialedNumber((prev) => prev + char);
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleClearNumber = () => {
    setDialedNumber('');
  };

  const handleDirectVoipCall = (contactOrPhone?: { name?: string; phone: string; avatar?: string; relationship?: string }) => {
    const targetPhone = contactOrPhone?.phone || dialedNumber;
    if (!targetPhone.trim()) {
      showToast('Please enter a phone number to call.');
      return;
    }
    startCall(
      {
        name: contactOrPhone?.name || 'Dialed Number',
        phone: targetPhone,
        avatar: contactOrPhone?.avatar,
        relationship: contactOrPhone?.relationship,
      },
      false
    );
  };

  const handleDirectCellularCall = (phoneToCall?: string) => {
    const target = phoneToCall || dialedNumber;
    if (!target.trim()) {
      showToast('Please enter a phone number to call.');
      return;
    }
    startCall(
      {
        name: 'Direct Cellular Line',
        phone: target,
      },
      true
    );
  };

  const handleImportDeviceContactsClick = async () => {
    showToast('Opening phone address book picker...');
    const result = await importDeviceContacts();
    showToast(result.message);
  };

  const handleVCardFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseVCardContent(content);
        if (parsed.length > 0) {
          parsed.forEach((c) => addPhoneContact(c));
          showToast(`Imported ${parsed.length} contacts from .vcf file.`);
        } else {
          showToast('No contacts found in file.');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveNewContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) {
      showToast('Name and phone number are required.');
      return;
    }

    addPhoneContact({
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRelationship.trim() || 'Contact',
      category: newContactCategory,
      source: 'manual',
      isFavorite: false,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newContactName)}&background=0D9488&color=fff`,
    });

    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelationship('');
    setShowAddContactModal(false);
    showToast('Contact added to phone directory.');
  };

  // Contacts filtering
  const filteredContacts = phoneContacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.relationship && c.relationship.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterCategory === 'all') return true;
    if (filterCategory === 'favorites') return c.isFavorite;
    if (filterCategory === 'device') return c.source === 'device';
    return c.category === filterCategory;
  });

  const favorites = phoneContacts.filter((c) => c.isFavorite);

  return (
    <div className="space-y-4 pb-28 pt-2">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg shadow-emerald-900/50 flex items-center gap-2 animate-bounce">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-teal-500/10 via-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Sovereign Phone & Dialer</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Direct Carrier Bridge
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Thamiz (Primary Account)</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-400/90">+91 98401 23456</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImportDeviceContactsClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700/60"
              title="Get phone contacts directly from your mobile device"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Get Phone Contacts</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
              title="Import .VCF vCard contacts file"
            >
              <Upload className="w-4 h-4 text-slate-300" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleVCardFileUpload}
              accept=".vcf,.vcard"
              className="hidden"
            />

            <button
              onClick={() => setShowAddContactModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all shadow-md shadow-emerald-900/30"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Feature status strip */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auro AI In-Call Co-pilot & Auto Post-Call Executive Briefings Active</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span>{phoneContacts.length} Contacts</span>
            <span>•</span>
            <span>{callLogs.length} Recent Calls</span>
          </div>
        </div>
      </div>

      {/* Main Sub-Navigation: Dialpad | Contacts Directory | Recent Calls */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveSubTab('dialpad')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'dialpad'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Dialpad</span>
        </button>

        <button
          onClick={() => setActiveSubTab('contacts')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'contacts'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Contacts ({phoneContacts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recents')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'recents'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Recent Calls ({callLogs.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: DIALPAD */}
      {activeSubTab === 'dialpad' && (
        <div className="space-y-4">
          {/* Quick Speed Dial Favorites Carousel */}
          {favorites.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                Speed Dial Favorites
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    onClick={() => handleDirectVoipCall(fav)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition-all shrink-0 group"
                  >
                    <img
                      src={fav.avatar}
                      alt={fav.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-white truncate max-w-[110px]">
                        {fav.name.split(' ')[0]}
                      </p>
                      <p className="text-[10px] text-slate-400">{fav.relationship || 'Favorite'}</p>
                    </div>
                    <Phone className="w-3.5 h-3.5 text-emerald-400 ml-1 opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dialpad Display & Controls */}
          <div className="max-w-xs sm:max-w-sm mx-auto p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            {/* Number Display Box */}
            <div className="relative flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 min-h-[58px]">
              <input
                type="text"
                value={dialedNumber}
                onChange={(e) => setDialedNumber(e.target.value)}
                placeholder="Enter phone number..."
                className="w-full bg-transparent font-mono text-xl sm:text-2xl font-bold text-center tracking-wider text-white placeholder-slate-600 focus:outline-none"
              />

              {dialedNumber && (
                <button
                  onClick={handleBackspace}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors absolute right-2"
                  title="Delete digit"
                >
                  <Delete className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Dialpad Keys (1-9, *, 0, #) with DTMF audio feedback */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              {[
                { key: '1', letters: '' },
                { key: '2', letters: 'ABC' },
                { key: '3', letters: 'DEF' },
                { key: '4', letters: 'GHI' },
                { key: '5', letters: 'JKL' },
                { key: '6', letters: 'MNO' },
                { key: '7', letters: 'PQRS' },
                { key: '8', letters: 'TUV' },
                { key: '9', letters: 'WXYZ' },
                { key: '*', letters: '' },
                { key: '0', letters: '+' },
                { key: '#', letters: '' },
              ].map(({ key, letters }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  className="py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-emerald-600 active:scale-95 text-white transition-all flex flex-col items-center justify-center border border-slate-700/50 shadow-sm"
                >
                  <span className="font-mono text-xl font-bold">{key}</span>
                  {letters && (
                    <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
                      {letters}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Two Primary Call Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {/* Sovereign VoIP In-App Direct Call */}
              <button
                onClick={() => handleDirectVoipCall()}
                disabled={!dialedNumber.trim()}
                className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs shadow-lg shadow-emerald-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                title="Make sovereign call within app with live Auro AI assistant"
              >
                <PhoneCall className="w-4 h-4" />
                <span>In-App Call</span>
              </button>

              {/* Direct Native Cellular Call (Carrier tel: link) */}
              <button
                onClick={() => handleDirectCellularCall()}
                disabled={!dialedNumber.trim()}
                className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 hover:text-emerald-300 font-semibold text-xs border border-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                title="Launch device phone app directly to place cellular call"
              >
                <Phone className="w-4 h-4" />
                <span>Cellular Call</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CONTACTS DIRECTORY */}
      {activeSubTab === 'contacts' && (
        <div className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search phone contacts by name, number, relationship..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'all'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All ({phoneContacts.length})
              </button>
              <button
                onClick={() => setFilterCategory('favorites')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'favorites'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Favorites ({favorites.length})</span>
              </button>
              <button
                onClick={() => setFilterCategory('family')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'family'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Family
              </button>
              <button
                onClick={() => setFilterCategory('business')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'business'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Business
              </button>
              <button
                onClick={() => setFilterCategory('device')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'device'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Device Contacts
              </button>
            </div>
          </div>

          {/* Contacts List */}
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-emerald-500/30 transition-all flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="font-bold text-white text-sm truncate">{contact.name}</h4>
                      {contact.isFavorite && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      {contact.source === 'device' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          From Phone
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-emerald-400/90">{contact.phone}</span>
                      {contact.relationship && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span>{contact.relationship}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* In-App Direct Call Button */}
                  <button
                    onClick={() => handleDirectVoipCall(contact)}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/30"
                    title={`Make direct sovereign call to ${contact.name}`}
                  >
                    <PhoneCall className="w-4 h-4" />
                  </button>

                  {/* Native Cellular Call Button */}
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white transition-colors border border-slate-700"
                    title={`Place direct cellular call via carrier to ${contact.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>

                  {/* Toggle Favorite */}
                  <button
                    onClick={() => toggleContactFavorite(contact.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                    title="Toggle Favorite"
                  >
                    <Star className={`w-4 h-4 ${contact.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                </div>
              </div>
            ))}

            {filteredContacts.length === 0 && (
              <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No contacts match your query.</p>
                <button
                  onClick={handleImportDeviceContactsClick}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                >
                  Import Phone Contacts
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: RECENT CALLS */}
      {activeSubTab === 'recents' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Call History & AI Briefings
            </span>
            <span>{callLogs.length} Total Logs</span>
          </div>

          <div className="space-y-2">
            {callLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLogDetail(log)}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0">
                      <PhoneForwarded className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-xs">{log.contactName}</h4>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400">
                          {log.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{log.phone}</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                        {log.durationSeconds > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">
                              {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDirectVoipCall({ name: log.contactName, phone: log.phone, avatar: log.avatar });
                      }}
                      className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                      title="Call back directly"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`tel:${log.phone.replace(/[^0-9+]/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Place cellular call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* AI Summary Snippet */}
                {log.aiSummary && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-indigo-500/20 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>Auro Call Briefing:</span>
                    </div>
                    <p className="line-clamp-2 italic text-slate-400">{log.aiSummary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl relative text-white">
            <button
              onClick={() => setShowAddContactModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white">Add Phone Contact</h3>
              <p className="text-xs text-slate-400">
                Save directly to your encrypted phone directory.
              </p>
            </div>

            <form onSubmit={handleSaveNewContact} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Selvapriya or Arjun Mehta"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98401 54321"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Relationship / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Venture Partner, Legal Counsel"
                  value={newContactRelationship}
                  onChange={(e) => setNewContactRelationship(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Category
                </label>
                <select
                  value={newContactCategory}
                  onChange={(e) => setNewContactCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="family">Family</option>
                  <option value="business">Business</option>
                  <option value="medical">Medical</option>
                  <option value="security">Security</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-900/40"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Call Log Detail Modal */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl relative text-white">
            <button
              onClick={() => setSelectedLogDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{selectedLogDetail.contactName}</h3>
                <p className="font-mono text-xs text-slate-400">{selectedLogDetail.phone}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Timestamp:</span>
                <span className="text-slate-200">{selectedLogDetail.timestamp}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Duration:</span>
                <span className="text-emerald-400 font-semibold font-mono">
                  {Math.floor(selectedLogDetail.durationSeconds / 60)}m {selectedLogDetail.durationSeconds % 60}s
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Call Type:</span>
                <span className="capitalize text-slate-200">{selectedLogDetail.type}</span>
              </div>
            </div>

            {selectedLogDetail.aiSummary && (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auro AI Call Briefing</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{selectedLogDetail.aiSummary}</p>

                {selectedLogDetail.actionItems && selectedLogDetail.actionItems.length > 0 && (
                  <div className="pt-2 border-t border-indigo-500/20 space-y-1">
                    <span className="text-[11px] font-semibold text-indigo-400">Action Items:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                      {selectedLogDetail.actionItems.map((ai, idx) => (
                        <li key={idx}>{ai}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  const log = selectedLogDetail;
                  setSelectedLogDetail(null);
                  handleDirectVoipCall({ name: log.contactName, phone: log.phone });
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Back</span>
              </button>

              <a
                href={`tel:${selectedLogDetail.phone.replace(/[^0-9+]/g, '')}`}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Native Call</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
