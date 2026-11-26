import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Plane,
  Ticket,
  Upload,
  Sparkles,
  Bell,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wallet,
  Plus,
  HardDrive,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  FamilyLifeRecord,
  IdentityDocCategory,
  IdentityDocPayload,
  OfflineTicketPayload,
  TripPackingItem,
  TripPlanPayload,
} from '../../types/familyLifeSuite';
import {
  callFamilyLifeAi,
  deleteFamilyLifeRecord,
  downscaleImageToDataUrl,
  loadFamilyLifeRecords,
  saveFamilyLifeRecord,
  scheduleIdentityRenewalReminders,
  syncAllFamilyLifeWithDrive,
} from '../../services/familyLifeSuiteService';
import { saveMediaMetadataToSqlite, storeMediaItemLocallyInSqlite } from '../../services/mediaLibraryService';

export const IdentityTravelVaultTab: React.FC = () => {
  const { user, googleAccessToken, addTransaction } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';

  const [subTab, setSubTab] = useState<'ids' | 'trips' | 'tickets'>('ids');
  const [idDocs, setIdDocs] = useState<FamilyLifeRecord<IdentityDocPayload>[]>([]);
  const [trips, setTrips] = useState<FamilyLifeRecord<TripPlanPayload>[]>([]);
  const [tickets, setTickets] = useState<FamilyLifeRecord<OfflineTicketPayload>[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // ID Scanner / Form state
  const [isExtractingId, setIsExtractingId] = useState(false);
  const [docCategory, setDocCategory] = useState<IdentityDocCategory>('Passport');
  const [holderName, setHolderName] = useState(user?.name || 'Family Member');
  const [docNumber, setDocNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('HM Passport Office / Govt');
  const [country, setCountry] = useState('UK');
  const [expiryDate, setExpiryDate] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [idPreviewImg, setIdPreviewImg] = useState<string>('');
  const [idUploadFile, setIdUploadFile] = useState<File | null>(null);
  const idFileRef = useRef<HTMLInputElement | null>(null);

  // Trip Planner state
  const [destInput, setDestInput] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]);
  const [travelers, setTravelers] = useState('2 Adults, 1 Child (Age 6)');
  const [budgetAmount, setBudgetAmount] = useState('1500');
  const [currency, setCurrency] = useState('£');
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [newPackItem, setNewPackItem] = useState('');

  // Offline Ticket Wallet state
  const [ticketTripName, setTicketTripName] = useState('');
  const [ticketCarrier, setTicketCarrier] = useState('');
  const [ticketPassenger, setTicketPassenger] = useState(user?.name || 'Family');
  const [ticketDate, setTicketDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [ticketRef, setTicketRef] = useState('');
  const [ticketSeat, setTicketSeat] = useState('');
  const [ticketDataUrl, setTicketDataUrl] = useState('');
  const ticketFileRef = useRef<HTMLInputElement | null>(null);

  const reloadAll = useCallback(async () => {
    const all = await loadFamilyLifeRecords(undefined, { userEmail, googleAccessToken });
    setIdDocs(all.filter((r) => r.domain === 'identity_doc'));
    setTrips(all.filter((r) => r.domain === 'trip_plan'));
    setTickets(all.filter((r) => r.domain === 'offline_ticket'));
  }, [userEmail, googleAccessToken]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const daysUntil = (iso?: string) => {
    if (!iso) return 999;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  };

  const handleScanIdPhoto = async (file: File) => {
    setIsExtractingId(true);
    setIdUploadFile(file);
    try {
      const { dataUrl, mime } = await downscaleImageToDataUrl(file, 1280);
      setIdPreviewImg(dataUrl);
      const ai = await callFamilyLifeAi<any>({
        mode: 'extract_id_document',
        imageBase64: dataUrl,
        mimeType: mime,
      });
      if (ai.result) {
        if (ai.result.docCategory) setDocCategory(ai.result.docCategory);
        if (ai.result.holderName) setHolderName(ai.result.holderName);
        if (ai.result.documentNumber) setDocNumber(ai.result.documentNumber);
        if (ai.result.issuingAuthority) setIssuingAuthority(ai.result.issuingAuthority);
        if (ai.result.country) setCountry(ai.result.country);
        if (ai.result.expiryDate) setExpiryDate(ai.result.expiryDate);
        if (ai.result.notes) setDocNotes(ai.result.notes);
        setStatusBanner(`✨ Vision AI extracted ${ai.result.docCategory || 'ID'} details via ${ai.modelUsed}!`);
      } else {
        setStatusBanner('Photo attached — fill or verify expiry date below to schedule 90/30/7-day alerts.');
      }
    } finally {
      setIsExtractingId(false);
    }
  };

  const handleSaveIdAndReminders = async () => {
    if (!holderName.trim() || !expiryDate) {
      setStatusBanner('Please provide Holder Name and Expiry Date.');
      return;
    }

    let linkedMediaId: string | undefined;
    // Link uploaded ID scan directly into Media Vault (/Identity & Policies) + local SQLite offline cache!
    if (idUploadFile && idPreviewImg) {
      try {
        const mediaItem = await saveMediaMetadataToSqlite({
          userEmail,
          fileName: `${docCategory.replace(/\W+/g, '_')}_${holderName.replace(/\W+/g, '_')}.jpg`,
          folderPath: '/Identity & Policies',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          fileSize: idUploadFile.size,
          thumbnailDataUrl: idPreviewImg,
          tags: ['identity', docCategory.toLowerCase(), holderName.toLowerCase()],
          category: 'Documents',
          ownerName: holderName,
          deviceSource: 'Identity Vault',
        });
        await storeMediaItemLocallyInSqlite(mediaItem, { file: idUploadFile, googleAccessToken, userEmail }).catch(() => {});
        linkedMediaId = mediaItem.id;
      } catch {}
    }

    const payload: IdentityDocPayload = {
      docCategory,
      holderName: holderName.trim(),
      documentNumber: docNumber.trim() || 'Recorded',
      issuingAuthority: issuingAuthority.trim(),
      country: country.trim(),
      expiryDate,
      linkedMediaId,
      thumbnailDataUrl: idPreviewImg || undefined,
      remindersScheduled: true,
      notes: docNotes.trim(),
    };

    const alertCount = await scheduleIdentityRenewalReminders(payload, googleAccessToken, userEmail);
    const saved = await saveFamilyLifeRecord<IdentityDocPayload>(
      {
        domain: 'identity_doc',
        title: `${docCategory} — ${holderName.trim()}`,
        subtitle: `#${payload.documentNumber} · Expires ${expiryDate}`,
        memberName: holderName.trim(),
        dueOrExpiryDate: expiryDate,
        payload,
      },
      { userEmail, googleAccessToken }
    );

    setIdDocs((prev) => [saved, ...prev]);
    setDocNumber('');
    setDocNotes('');
    setIdPreviewImg('');
    setIdUploadFile(null);
    setStatusBanner(
      `✅ Saved ${docCategory} to SQLite & Drive${linkedMediaId ? ' + Media Vault' : ''} + scheduled ${alertCount} renewal alert(s) (90/30/7 days)!`
    );
  };

  const handleGenerateTripPlan = async () => {
    if (!destInput.trim()) return;
    setIsGeneratingTrip(true);
    try {
      const ai = await callFamilyLifeAi<any>({
        mode: 'generate_trip_plan',
        promptContext: `Destination: ${destInput}, Dates: ${startDate} to ${endDate}, Travelers: ${travelers}, Budget: ${currency}${budgetAmount}`,
      });

      const fallbackItinerary = [
        {
          day: 1,
          title: `Arrival & Welcome Walk in ${destInput}`,
          morning: 'Check-in, unpack essentials, hydrate & light brunch',
          afternoon: 'Family park / waterfront stroll & local sightseeing',
          evening: 'Early family dinner & rest',
          kidsTip: 'Keep snacks & offline games handy during transit.',
        },
        {
          day: 2,
          title: `${destInput} Highlights & Kid-Friendly Museum`,
          morning: 'Interactive science/history attraction before crowds',
          afternoon: 'Local lunch + scenic viewpoint photos',
          evening: 'Relaxed market walk & souvenirs',
          kidsTip: 'Schedule a 45-min afternoon rest break.',
        },
      ];

      const rawPack = Array.isArray(ai.result?.packingList)
        ? ai.result.packingList
        : [
            { label: 'Passports, Visas & Insurance PDFs', category: 'Documents' },
            { label: 'Boarding passes saved in Offline Wallet', category: 'Documents' },
            { label: 'Kids snacks, refillable water bottles & wipes', category: 'Kids' },
            { label: 'Paracetamol / Calpol, plasters & regular meds', category: 'Meds & Toiletries' },
            { label: 'Universal travel adapter & power bank', category: 'Tech' },
            { label: 'Weather-layered outfits & comfy walking shoes', category: 'Clothing' },
          ];

      const packingList: TripPackingItem[] = rawPack.map((p: any, idx: number) => ({
        id: `pk-${Date.now()}-${idx}`,
        label: String(p.label || p),
        category: p.category || 'Clothing',
        packed: false,
      }));

      const payload: TripPlanPayload = {
        destination: ai.result?.destination || destInput.trim(),
        startDate,
        endDate,
        travelers,
        estimatedBudget: Number(ai.result?.estimatedBudget || budgetAmount) || 1500,
        currency: ai.result?.currency || currency,
        itinerary: Array.isArray(ai.result?.itinerary) && ai.result.itinerary.length > 0 ? ai.result.itinerary : fallbackItinerary,
        packingList,
      };

      const saved = await saveFamilyLifeRecord<TripPlanPayload>(
        {
          domain: 'trip_plan',
          title: `Trip to ${payload.destination}`,
          subtitle: `${startDate} → ${endDate} · ${payload.currency}${payload.estimatedBudget}`,
          dueOrExpiryDate: startDate,
          payload,
        },
        { userEmail, googleAccessToken }
      );
      setTrips((prev) => [saved, ...prev]);
      setDestInput('');
      setStatusBanner(`✈️ Created AI Trip & Packing Plan for ${payload.destination}!`);
    } finally {
      setIsGeneratingTrip(false);
    }
  };

  const handleTogglePacked = async (trip: FamilyLifeRecord<TripPlanPayload>, itemId: string) => {
    const nextList = trip.payload.packingList.map((p) => (p.id === itemId ? { ...p, packed: !p.packed } : p));
    const updated = await saveFamilyLifeRecord<TripPlanPayload>(
      {
        id: trip.id,
        domain: 'trip_plan',
        title: trip.title,
        subtitle: trip.subtitle,
        dueOrExpiryDate: trip.dueOrExpiryDate,
        payload: { ...trip.payload, packingList: nextList },
      },
      { userEmail, googleAccessToken }
    );
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleSaveOfflineTicket = async () => {
    if (!ticketTripName.trim() || !ticketRef.trim()) {
      setStatusBanner('Enter Trip/Route name and Booking Reference.');
      return;
    }
    const payload: OfflineTicketPayload = {
      tripName: ticketTripName.trim(),
      carrierOrVenue: ticketCarrier.trim() || 'Airline / Rail',
      passengerName: ticketPassenger.trim(),
      departureDate: ticketDate,
      bookingRef: ticketRef.trim().toUpperCase(),
      seatOrGate: ticketSeat.trim(),
      fileDataUrl: ticketDataUrl || undefined,
    };
    const saved = await saveFamilyLifeRecord<OfflineTicketPayload>(
      {
        domain: 'offline_ticket',
        title: `${payload.tripName} (${payload.bookingRef})`,
        subtitle: `${payload.passengerName} · ${payload.departureDate}`,
        memberName: payload.passengerName,
        dueOrExpiryDate: payload.departureDate,
        payload,
      },
      { userEmail, googleAccessToken }
    );
    setTickets((prev) => [saved, ...prev]);
    setTicketTripName('');
    setTicketRef('');
    setTicketSeat('');
    setTicketDataUrl('');
    setStatusBanner('🎫 Boarding pass / ticket cached locally in SQLite for 100% airport offline access!');
  };

  return (
    <div className="space-y-4 pb-24 text-white">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-amber-950/85 border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-200 border border-amber-400/40">
            🛂 Never Miss a Renewal · 90 / 30 / 7-Day Alerts · Airport Offline Wallet
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Family Identity, Travel & Expiry Vault
          </h2>
        </div>
        <button
          onClick={async () => {
            setIsSyncing(true);
            const res = await syncAllFamilyLifeWithDrive(userEmail, googleAccessToken);
            setIsSyncing(false);
            setStatusBanner(
              res.needsSignIn
                ? 'Connect Google Drive in header to mirror vault to cloud.'
                : `☁️ Synced ${res.total} family records with Google Drive + SQLite!`
            );
          }}
          className="px-3.5 py-2 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Vault with Drive
        </button>
      </div>

      {statusBanner && (
        <div className="rounded-2xl bg-cyan-500/15 border border-cyan-400/40 px-4 py-2.5 text-xs text-cyan-100 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="text-slate-300 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Sub-Tab Switcher */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'ids', label: `🛂 IDs & Policies (${idDocs.length})`, icon: ShieldCheck },
          { id: 'trips', label: `✈️ AI Trip & Packing (${trips.length})`, icon: Plane },
          { id: 'tickets', label: `🎫 Offline Ticket Wallet (${tickets.length})`, icon: Ticket },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
              subTab === t.id
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg'
                : 'bg-slate-900/85 text-slate-300 border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: PASSPORT, VISA, NHS/AADHAAR, LICENCE & INSURANCE TRACKER */}
      {subTab === 'ids' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">Add / Scan Official ID or Insurance Policy</h3>
              <button
                onClick={() => idFileRef.current?.click()}
                disabled={isExtractingId}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isExtractingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isExtractingId ? 'Vision AI Scanning...' : 'Snap / Upload ID or Policy'}
              </button>
              <input
                ref={idFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleScanIdPhoto(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as IdentityDocCategory)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
              >
                {[
                  'Passport',
                  'Visa / BRP',
                  'NHS / Aadhaar',
                  'Driving Licence',
                  'Health Insurance',
                  'Motor / Home Insurance',
                  'Other Official ID',
                ].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Family Member Name"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Document / Policy Number"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="Issuing Authority / Insurer"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country (e.g. UK / India)"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/40 text-amber-200 font-bold"
              />
            </div>

            <button
              onClick={() => void handleSaveIdAndReminders()}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Bell className="w-4 h-4" />
              Save to Vault (SQLite + Drive + Media Vault) & Schedule 90 / 30 / 7-Day Renewal Alerts
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {idDocs.map((doc) => {
              const p = doc.payload;
              const remDays = daysUntil(p.expiryDate);
              const urgent = remDays <= 30;
              const soon = remDays > 30 && remDays <= 90;
              return (
                <div
                  key={doc.id}
                  className={`rounded-3xl p-4 border space-y-2 text-xs ${
                    urgent
                      ? 'bg-rose-950/40 border-rose-400/50'
                      : soon
                      ? 'bg-amber-950/35 border-amber-400/45'
                      : 'bg-slate-900/90 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/10 text-cyan-200">
                        {p.docCategory} · {p.country}
                      </span>
                      <h4 className="text-base font-black text-white mt-1">{p.holderName}</h4>
                      <div className="text-slate-300 font-mono text-[11px]">#{p.documentNumber} · {p.issuingAuthority}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(doc.id, googleAccessToken);
                        setIdDocs((prev) => prev.filter((x) => x.id !== doc.id));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <span className={`font-extrabold ${urgent ? 'text-rose-300' : soon ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {remDays < 0
                        ? `⚠️ Expired ${Math.abs(remDays)}d ago (${p.expiryDate})`
                        : `⏳ Expires ${p.expiryDate} (${remDays} days left)`}
                    </span>
                    {p.linkedMediaId && (
                      <span className="text-[10px] text-cyan-300 inline-flex items-center gap-1 font-bold">
                        <FolderOpen className="w-3 h-3" /> Linked in Media Vault
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AI FAMILY TRIP & PACKING PLANNER */}
      {subTab === 'trips' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-black text-white">✨ AI Family Trip Itinerary & Kid-Friendly Packing Builder</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
                placeholder="Destination (e.g. Edinburgh, Paris, Chennai)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={travelers} onChange={(e) => setTravelers(e.target.value)} placeholder="Travelers" className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold">
                <option value="£">£ GBP</option>
                <option value="₹">₹ INR</option>
                <option value="$">$ USD</option>
                <option value="€">€ EUR</option>
              </select>
              <input type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="Budget" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
            </div>
            <button
              onClick={() => void handleGenerateTripPlan()}
              disabled={isGeneratingTrip}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGeneratingTrip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGeneratingTrip ? 'Designing Family Itinerary & Packing Checklist...' : 'Generate AI Family Trip & Packing Checklist'}
            </button>
          </div>

          {trips.map((trip) => {
            const p = trip.payload;
            const packedCount = p.packingList.filter((x) => x.packed).length;
            return (
              <div key={trip.id} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-white">✈️ {p.destination}</h4>
                    <p className="text-slate-400">
                      {p.startDate} → {p.endDate} · {p.travelers} · Budget: <strong className="text-emerald-300">{p.currency}{p.estimatedBudget}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.loggedToFinance && (
                      <button
                        onClick={async () => {
                          addTransaction({
                            title: `Family Trip: ${p.destination}`,
                            category: 'Family & Kids',
                            amount: p.estimatedBudget,
                            type: 'expense',
                            date: p.startDate,
                            member: user?.name || 'Family',
                          });
                          const u = await saveFamilyLifeRecord<TripPlanPayload>(
                            {
                              id: trip.id,
                              domain: 'trip_plan',
                              title: trip.title,
                              subtitle: trip.subtitle,
                              payload: { ...p, loggedToFinance: true },
                            },
                            { userEmail, googleAccessToken }
                          );
                          setTrips((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                          setStatusBanner(`💰 Logged ${p.currency}${p.estimatedBudget} trip expense to Finance Hub!`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5" /> Log to Finance Hub
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(trip.id, googleAccessToken);
                        setTrips((prev) => prev.filter((x) => x.id !== trip.id));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Itinerary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {p.itinerary.map((d) => (
                    <div key={d.day} className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-1">
                      <div className="font-extrabold text-cyan-300">Day {d.day}: {d.title}</div>
                      <div className="text-slate-300">☀️ {d.morning}</div>
                      <div className="text-slate-300">🌤️ {d.afternoon}</div>
                      <div className="text-slate-300">🌙 {d.evening}</div>
                      {d.kidsTip && <div className="text-[11px] text-amber-200 pt-1">👶 {d.kidsTip}</div>}
                    </div>
                  ))}
                </div>

                {/* Packing List */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold uppercase text-[11px] text-amber-300">
                      🧳 Packing Checklist ({packedCount}/{p.packingList.length} packed)
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        value={newPackItem}
                        onChange={(e) => setNewPackItem(e.target.value)}
                        placeholder="Add custom item..."
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px]"
                      />
                      <button
                        onClick={async () => {
                          if (!newPackItem.trim()) return;
                          const nextList: TripPackingItem[] = [
                            ...p.packingList,
                            { id: `pk-${Date.now()}`, label: newPackItem.trim(), category: 'Kids', packed: false },
                          ];
                          const u = await saveFamilyLifeRecord<TripPlanPayload>(
                            { id: trip.id, domain: 'trip_plan', title: trip.title, subtitle: trip.subtitle, payload: { ...p, packingList: nextList } },
                            { userEmail, googleAccessToken }
                          );
                          setTrips((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                          setNewPackItem('');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {p.packingList.map((item) => (
                      <label
                        key={item.id}
                        onClick={() => void handleTogglePacked(trip, item.id)}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          item.packed ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 line-through' : 'bg-slate-950 border-white/10 text-slate-200'
                        }`}
                      >
                        <span>{item.label}</span>
                        <CheckCircle2 className={`w-4 h-4 ${item.packed ? 'text-emerald-400' : 'text-slate-600'}`} />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: OFFLINE BOARDING-PASS & TICKET WALLET */}
      {subTab === 'tickets' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">🎫 Offline Boarding-Pass & Ticket Wallet</h3>
                <p className="text-[11px] text-slate-400">Stored directly in local SQLite so QR/barcodes open instantly in airplane mode!</p>
              </div>
              <button
                onClick={() => ticketFileRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold cursor-pointer"
              >
                Attach QR / Pass Screenshot
              </button>
              <input
                ref={ticketFileRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const { dataUrl } = await downscaleImageToDataUrl(f, 1200);
                    setTicketDataUrl(dataUrl);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input value={ticketTripName} onChange={(e) => setTicketTripName(e.target.value)} placeholder="Route / Event (e.g. LHR → MAA)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={ticketCarrier} onChange={(e) => setTicketCarrier(e.target.value)} placeholder="Airline / Train / Venue" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={ticketPassenger} onChange={(e) => setTicketPassenger(e.target.value)} placeholder="Passenger Name" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={ticketRef} onChange={(e) => setTicketRef(e.target.value)} placeholder="PNR / Booking Ref" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono uppercase" />
              <input value={ticketSeat} onChange={(e) => setTicketSeat(e.target.value)} placeholder="Gate / Seat (e.g. 14A)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
            </div>

            <button
              onClick={() => void handleSaveOfflineTicket()}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <HardDrive className="w-4 h-4" /> Save Boarding Pass to Local SQLite Offline Wallet
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tickets.map((tk) => (
              <div key={tk.id} className="rounded-3xl bg-slate-900/95 border border-emerald-400/35 p-4 space-y-2.5 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-black">
                      ✓ OFFLINE SQLITE READY · {tk.payload.carrierOrVenue}
                    </span>
                    <h4 className="text-base font-black text-white mt-1">{tk.payload.tripName}</h4>
                    <p className="text-slate-300">
                      {tk.payload.passengerName} · {tk.payload.departureDate} {tk.payload.seatOrGate ? `· Seat ${tk.payload.seatOrGate}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-black text-amber-300">{tk.payload.bookingRef}</div>
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(tk.id, googleAccessToken);
                        setTickets((prev) => prev.filter((x) => x.id !== tk.id));
                      }}
                      className="mt-1 p-1 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {tk.payload.fileDataUrl && (
                  <img src={tk.payload.fileDataUrl} alt={tk.title} className="w-full max-h-52 object-contain rounded-2xl bg-white p-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
