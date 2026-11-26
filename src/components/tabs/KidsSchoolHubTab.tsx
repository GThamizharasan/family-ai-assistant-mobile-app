import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  Calendar,
  Star,
  Gift,
  Plus,
  Trash2,
  Loader2,
  Volume2,
  GraduationCap,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ChoreHabitPayload,
  FamilyLifeRecord,
  HomeworkCoachPayload,
  KidsRewardPayload,
  SchoolEventPayload,
} from '../../types/familyLifeSuite';
import {
  callFamilyLifeAi,
  deleteFamilyLifeRecord,
  downscaleImageToDataUrl,
  loadFamilyLifeRecords,
  saveFamilyLifeRecord,
} from '../../services/familyLifeSuiteService';
import { createReminder } from '../../services/reminderDriveSync';
import { speechEngine } from '../../services/speech';
import { TabKey } from '../BottomNav';

interface KidsSchoolHubTabProps {
  onNavigateTab?: (tab: TabKey) => void;
}

const DEFAULT_HABITS = [
  { title: 'Brush Teeth (Morning & Night)', icon: '🪥', stars: 5 },
  { title: '20 Mins English / தமிழ் Story Reading', icon: '📖', stars: 10 },
  { title: 'Kids Maths Practice / Tables', icon: '🧮', stars: 10 },
  { title: 'Pack School Bag & Uniform Ready', icon: '🎒', stars: 8 },
  { title: 'Tidy Toys & Study Desk', icon: '🧸', stars: 7 },
];

const DEFAULT_REWARDS = [
  { title: 'Pick Friday Family Movie Night', icon: '🎬', costStars: 40 },
  { title: 'Weekend Park / Cycling Adventure', icon: '🚲', costStars: 50 },
  { title: 'Favorite Healthy Smoothie / Treat', icon: '🍓', costStars: 30 },
  { title: 'New Storybook or Puzzle Choice', icon: '🧩', costStars: 80 },
];

export const KidsSchoolHubTab: React.FC<KidsSchoolHubTabProps> = ({ onNavigateTab }) => {
  const { user, googleAccessToken } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';
  const todayIso = new Date().toISOString().split('T')[0];

  const [subTab, setSubTab] = useState<'homework' | 'diary' | 'chores'>('homework');
  const [childName, setChildName] = useState('Adithya');
  const [homeworkList, setHomeworkList] = useState<FamilyLifeRecord<HomeworkCoachPayload>[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<FamilyLifeRecord<SchoolEventPayload>[]>([]);
  const [habits, setHabits] = useState<FamilyLifeRecord<ChoreHabitPayload>[]>([]);
  const [rewards, setRewards] = useState<FamilyLifeRecord<KidsRewardPayload>[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  // Homework Coach State
  const [questionInput, setQuestionInput] = useState('');
  const [hwSubject, setHwSubject] = useState<HomeworkCoachPayload['subject']>('Maths');
  const [isCoaching, setIsCoaching] = useState(false);
  const [unlockedStageById, setUnlockedStageById] = useState<Record<string, number>>({});
  const [childAttemptById, setChildAttemptById] = useState<Record<string, string>>({});
  const hwFileRef = useRef<HTMLInputElement | null>(null);

  // School Diary / Circular State
  const [eventType, setEventType] = useState<SchoolEventPayload['eventType']>('Exam');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayIso);
  const [eventNote, setEventNote] = useState('');
  const [isScanningCircular, setIsScanningCircular] = useState(false);
  const circularFileRef = useRef<HTMLInputElement | null>(null);

  // Custom Habit
  const [newHabitTitle, setNewHabitTitle] = useState('');

  const reloadAll = useCallback(async () => {
    const all = await loadFamilyLifeRecords(undefined, { userEmail, googleAccessToken });
    setHomeworkList(all.filter((r) => r.domain === 'homework_session'));
    setSchoolEvents(all.filter((r) => r.domain === 'school_event'));

    let loadedHabits = all.filter((r) => r.domain === 'chore_habit');
    let loadedRewards = all.filter((r) => r.domain === 'reward_item');

    if (loadedHabits.length === 0) {
      const seeded: FamilyLifeRecord<ChoreHabitPayload>[] = [];
      for (const h of DEFAULT_HABITS) {
        const s = await saveFamilyLifeRecord<ChoreHabitPayload>(
          {
            domain: 'chore_habit',
            title: h.title,
            memberName: childName,
            payload: { childName, icon: h.icon, starsReward: h.stars, completedDates: [] },
          },
          { userEmail, googleAccessToken: null }
        );
        seeded.push(s);
      }
      loadedHabits = seeded;
    }

    if (loadedRewards.length === 0) {
      const seededR: FamilyLifeRecord<KidsRewardPayload>[] = [];
      for (const rw of DEFAULT_REWARDS) {
        const s = await saveFamilyLifeRecord<KidsRewardPayload>(
          {
            domain: 'reward_item',
            title: rw.title,
            memberName: childName,
            payload: { childName, icon: rw.icon, costStars: rw.costStars, redeemedCount: 0 },
          },
          { userEmail, googleAccessToken: null }
        );
        seededR.push(s);
      }
      loadedRewards = seededR;
    }

    setHabits(loadedHabits);
    setRewards(loadedRewards);
  }, [userEmail, googleAccessToken, childName]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const totalStarsBalance = useMemo(() => {
    const earned = habits.reduce((sum, h) => sum + (h.payload.completedDates?.length || 0) * (h.payload.starsReward || 5), 0);
    const spent = rewards.reduce((sum, r) => sum + (r.payload.redeemedCount || 0) * (r.payload.costStars || 30), 0);
    return Math.max(0, earned - spent);
  }, [habits, rewards]);

  const handleStartHomeworkCoach = async (file?: File) => {
    if (!file && !questionInput.trim()) return;
    setIsCoaching(true);
    try {
      let dataUrl: string | undefined;
      let mime = 'image/jpeg';
      if (file) {
        const down = await downscaleImageToDataUrl(file, 1280);
        dataUrl = down.dataUrl;
        mime = down.mime;
      }

      const ai = await callFamilyLifeAi<any>({
        mode: 'homework_coach',
        imageBase64: dataUrl,
        mimeType: mime,
        promptContext: `Child: ${childName}, Subject: ${hwSubject}. Question: ${questionInput || 'Extract from worksheet image'}`,
      });

      const payload: HomeworkCoachPayload = {
        subject: ai.result?.subject || hwSubject,
        childName,
        problemExtracted: ai.result?.problemExtracted || questionInput.trim() || 'Worksheet problem uploaded',
        conceptName: ai.result?.conceptName || `${hwSubject} Guided Problem Solving`,
        hint1: ai.result?.hint1 || 'Read the question slowly and underline the numbers or key words you already know.',
        hint2: ai.result?.hint2 || 'Break the problem into two smaller steps and solve the first part on rough paper.',
        stepByStepGuide: Array.isArray(ai.result?.stepByStepGuide)
          ? ai.result.stepByStepGuide
          : ['1. Identify what is given.', '2. Choose the operation or rule.', '3. Check if your answer makes sense!'],
        tamilExplanation:
          ai.result?.tamilExplanation ||
          'முதலில் கேள்வியில் கொடுக்கப்பட்டுள்ள தகவல்களைக் கவனித்து, படிப்படியாகத் தீர்க்க முயற்சி செய்யுங்கள்!',
        verificationCheckAnswer: ai.result?.verificationCheckAnswer || 'Compare your working step-by-step with your parent or teacher!',
      };

      const saved = await saveFamilyLifeRecord<HomeworkCoachPayload>(
        {
          domain: 'homework_session',
          title: `${payload.subject}: ${payload.conceptName}`,
          subtitle: payload.problemExtracted.slice(0, 70),
          memberName: childName,
          payload,
        },
        { userEmail, googleAccessToken }
      );

      setHomeworkList((prev) => [saved, ...prev]);
      setUnlockedStageById((prev) => ({ ...prev, [saved.id]: 1 }));
      setQuestionInput('');
      setBanner('🧠 Socratic Homework Coach ready — starts with Hint 1 (no spoon-feeding)!');
    } finally {
      setIsCoaching(false);
    }
  };

  const handleScanSchoolCircular = async (file: File) => {
    setIsScanningCircular(true);
    try {
      const { dataUrl, mime } = await downscaleImageToDataUrl(file, 1280);
      const ai = await callFamilyLifeAi<any>({
        mode: 'extract_school_circular',
        imageBase64: dataUrl,
        mimeType: mime,
      });
      const extractedEvents = Array.isArray(ai.result?.events) ? ai.result.events : [];
      if (extractedEvents.length > 0) {
        for (const ev of extractedEvents) {
          const saved = await saveFamilyLifeRecord<SchoolEventPayload>(
            {
              domain: 'school_event',
              title: String(ev.subjectOrItem || 'School Circular Event'),
              subtitle: `${ev.eventType || 'Circular / Event'} · ${ev.eventDate || todayIso}`,
              memberName: childName,
              dueOrExpiryDate: ev.eventDate || todayIso,
              payload: {
                eventType: ev.eventType || 'Circular / Event',
                childName,
                subjectOrItem: String(ev.subjectOrItem || 'School Notice'),
                eventDate: ev.eventDate || todayIso,
                dayOfWeek: ev.dayOfWeek,
                kitOrActionNote: String(ev.kitOrActionNote || 'Check school bag'),
              },
            },
            { userEmail, googleAccessToken }
          );
          setSchoolEvents((prev) => [saved, ...prev]);
          await createReminder(
            {
              title: `🏫 ${saved.title} (${childName})`,
              dueDate: ev.eventDate || todayIso,
              dueTime: '07:30',
              category: 'family',
              priority: 'high',
              familyMember: childName,
              notes: saved.payload.kitOrActionNote,
            },
            googleAccessToken,
            userEmail
          ).catch(() => {});
        }
        setBanner(`🏫 Extracted ${extractedEvents.length} school circular event(s) + scheduled morning reminders!`);
      } else {
        setBanner('Circular scanned — confirm event date below and click Add.');
      }
    } finally {
      setIsScanningCircular(false);
    }
  };

  const handleAddSchoolEvent = async () => {
    if (!eventTitle.trim()) return;
    const saved = await saveFamilyLifeRecord<SchoolEventPayload>(
      {
        domain: 'school_event',
        title: eventTitle.trim(),
        subtitle: `${eventType} · ${eventDate}`,
        memberName: childName,
        dueOrExpiryDate: eventDate,
        payload: {
          eventType,
          childName,
          subjectOrItem: eventTitle.trim(),
          eventDate,
          kitOrActionNote: eventNote.trim() || 'Prepare evening before',
        },
      },
      { userEmail, googleAccessToken }
    );
    setSchoolEvents((prev) => [saved, ...prev]);
    await createReminder(
      {
        title: `🏫 ${eventType}: ${eventTitle.trim()} (${childName})`,
        dueDate: eventDate,
        dueTime: '07:30',
        category: 'family',
        priority: 'high',
        familyMember: childName,
        notes: eventNote.trim(),
      },
      googleAccessToken,
      userEmail
    ).catch(() => {});
    setEventTitle('');
    setEventNote('');
    setBanner('✅ Added to School Diary & scheduled 7:30 AM reminder!');
  };

  return (
    <div className="space-y-4 pb-24 text-white">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-fuchsia-950/90 via-slate-900 to-cyan-950/90 border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40">
            🎒 Socratic Photo Homework Coach · School Circulars · ⭐ {totalStarsBalance} Stars Earned
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Kids Homework Helper, School Planner & Star Bank
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold">Learner:</span>
          <input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            className="w-28 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-white font-extrabold"
          />
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-black">
            ⭐ {totalStarsBalance}
          </span>
        </div>
      </div>

      {banner && (
        <div className="rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/40 px-4 py-2.5 text-xs text-fuchsia-100 flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'homework', label: '🧠 Photo Homework Coach' },
          { id: 'diary', label: `🏫 School Diary & Exams (${schoolEvents.length})` },
          { id: 'chores', label: `⭐ Chores & Rewards (${totalStarsBalance}★)` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
              subTab === t.id
                ? 'bg-gradient-to-r from-fuchsia-400 to-cyan-400 text-slate-950 shadow-lg'
                : 'bg-slate-900/85 text-slate-300 border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: SOCRATIC PHOTO HOMEWORK COACH */}
      {subTab === 'homework' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">📸 Snap School Worksheet or Type Question (Step-by-Step Hints First!)</h3>
                <p className="text-[11px] text-slate-400">Guides your child with Hint 1 → Hint 2 → Concept Steps before unlocking the final answer check.</p>
              </div>
              <button
                onClick={() => hwFileRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Snap Worksheet
              </button>
              <input
                ref={hwFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleStartHomeworkCoach(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={hwSubject}
                onChange={(e) => setHwSubject(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
              >
                {['Maths', 'Science', 'English', 'Tamil', 'General'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Type homework question (e.g. A train travels 120 km in 3 hours... or 3/4 + 1/8 = ?)"
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <button
                onClick={() => void handleStartHomeworkCoach()}
                disabled={isCoaching}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-slate-950 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isCoaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Coach Step-by-Step
              </button>
            </div>
          </div>

          {homeworkList.map((hw) => {
            const p = hw.payload;
            const stage = unlockedStageById[hw.id] || 1;
            const attempt = childAttemptById[hw.id] || '';
            return (
              <div key={hw.id} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-200 text-[10px] font-black">
                      {p.subject} · {p.conceptName}
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-white mt-1">{p.problemExtracted}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => speechEngine.speak(`${p.hint1} ${p.tamilExplanation}`)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Read Hint
                    </button>
                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('adaptive-learning')}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5" /> Practice in AI Classroom
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(hw.id, googleAccessToken);
                        setHomeworkList((prev) => prev.filter((x) => x.id !== hw.id));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progressive Socratic Hints */}
                <div className="p-3 rounded-2xl bg-amber-500/12 border border-amber-400/35 text-amber-100">
                  <strong className="text-amber-300 inline-flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Hint 1:</strong> {p.hint1}
                </div>

                {stage >= 2 && (
                  <div className="p-3 rounded-2xl bg-cyan-500/12 border border-cyan-400/35 text-cyan-100">
                    <strong className="text-cyan-300">Hint 2:</strong> {p.hint2}
                  </div>
                )}

                {stage >= 3 && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-1.5">
                    <div className="font-extrabold text-fuchsia-300">Step-by-Step Thinking Guide (EN + தமிழ்)</div>
                    {p.stepByStepGuide.map((s, idx) => (
                      <div key={idx} className="text-slate-200">• {s}</div>
                    ))}
                    <div className="text-amber-200 pt-1">{p.tamilExplanation}</div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {stage < 3 && (
                    <button
                      onClick={() => setUnlockedStageById((prev) => ({ ...prev, [hw.id]: stage + 1 }))}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                    >
                      Unlock {stage === 1 ? 'Hint 2' : 'Step-by-Step Guide'}
                    </button>
                  )}

                  <input
                    value={attempt}
                    onChange={(e) => setChildAttemptById((prev) => ({ ...prev, [hw.id]: e.target.value }))}
                    placeholder="Type your answer attempt here first to unlock check..."
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"
                  />
                  <button
                    disabled={!attempt.trim()}
                    onClick={() => setUnlockedStageById((prev) => ({ ...prev, [hw.id]: 4 }))}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold cursor-pointer disabled:opacity-40"
                  >
                    Check My Answer
                  </button>
                </div>

                {stage >= 4 && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-100">
                    <strong>✅ Verification Check:</strong> {p.verificationCheckAnswer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: SCHOOL DIARY, TIMETABLE, CIRCULAR SCANNER & EXAM COUNTDOWNS */}
      {subTab === 'diary' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">🏫 Add Exam, PE/Uniform Day, Library Book Return or Scan Circular</h3>
              <button
                onClick={() => circularFileRef.current?.click()}
                disabled={isScanningCircular}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isScanningCircular ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                Scan School Circular Photo
              </button>
              <input
                ref={circularFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleScanSchoolCircular(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
              >
                <option value="Exam">📝 Exam</option>
                <option value="Uniform / PE Kit">👟 Uniform / PE Kit</option>
                <option value="Library Book Return">📚 Library Book Return</option>
                <option value="Circular / Event">🎪 School Circular / Event</option>
              </select>
              <input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Subject / Kit / Book Title"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                placeholder="Note (e.g. White trainers)"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
            </div>
            <button
              onClick={() => void handleAddSchoolEvent()}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-4 h-4" /> Save to School Diary & Set 7:30 AM Reminder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {schoolEvents.map((ev) => {
              const days = Math.ceil((new Date(ev.payload.eventDate).getTime() - Date.now()) / 86_400_000);
              return (
                <div key={ev.id} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 text-[10px] font-black">
                      {ev.payload.eventType} · {ev.payload.eventDate}
                    </span>
                    <h4 className="text-sm font-black text-white">{ev.title}</h4>
                    <p className="text-slate-400">{ev.payload.kitOrActionNote}</p>
                    <div className="text-amber-300 font-extrabold">
                      {days < 0 ? 'Past event' : days === 0 ? '🔔 TODAY!' : `⏳ Countdown: ${days} day(s)`}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteFamilyLifeRecord(ev.id, googleAccessToken);
                      setSchoolEvents((prev) => prev.filter((x) => x.id !== ev.id));
                    }}
                    className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: KIDS CHORE & STAR REWARD BANK */}
      {subTab === 'chores' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Daily Habits */}
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" /> Today&apos;s Daily Habits ({todayIso})
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                placeholder="Add new daily habit..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <button
                onClick={async () => {
                  if (!newHabitTitle.trim()) return;
                  const s = await saveFamilyLifeRecord<ChoreHabitPayload>(
                    {
                      domain: 'chore_habit',
                      title: newHabitTitle.trim(),
                      memberName: childName,
                      payload: { childName, icon: '🌟', starsReward: 10, completedDates: [] },
                    },
                    { userEmail, googleAccessToken }
                  );
                  setHabits((prev) => [s, ...prev]);
                  setNewHabitTitle('');
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {habits.map((h) => {
                const doneToday = (h.payload.completedDates || []).includes(todayIso);
                return (
                  <div
                    key={h.id}
                    onClick={async () => {
                      const nextDates = doneToday
                        ? h.payload.completedDates.filter((d) => d !== todayIso)
                        : [...(h.payload.completedDates || []), todayIso];
                      const u = await saveFamilyLifeRecord<ChoreHabitPayload>(
                        {
                          id: h.id,
                          domain: 'chore_habit',
                          title: h.title,
                          memberName: childName,
                          payload: { ...h.payload, completedDates: nextDates },
                        },
                        { userEmail, googleAccessToken }
                      );
                      setHabits((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                    }}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      doneToday
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                        : 'bg-slate-950 border-white/10 text-white hover:border-amber-400/40'
                    }`}
                  >
                    <span className="font-bold">
                      {h.payload.icon} {h.title}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/25 text-amber-200 font-black">
                      {doneToday ? '✓ Earned ' : '+'}⭐ {h.payload.starsReward}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parent-Approved Star Reward Shop */}
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-fuchsia-400" /> Parent-Approved Star Reward Shop
              </h3>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/25 text-amber-200 font-black">
                Balance: ⭐ {totalStarsBalance}
              </span>
            </div>

            <div className="space-y-2">
              {rewards.map((rw) => {
                const canAfford = totalStarsBalance >= rw.payload.costStars;
                return (
                  <div key={rw.id} className="p-3 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-white">
                        {rw.payload.icon} {rw.title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Cost: ⭐ {rw.payload.costStars} · Redeemed {rw.payload.redeemedCount}x
                      </div>
                    </div>
                    <button
                      disabled={!canAfford}
                      onClick={async () => {
                        const u = await saveFamilyLifeRecord<KidsRewardPayload>(
                          {
                            id: rw.id,
                            domain: 'reward_item',
                            title: rw.title,
                            memberName: childName,
                            payload: { ...rw.payload, redeemedCount: (rw.payload.redeemedCount || 0) + 1 },
                          },
                          { userEmail, googleAccessToken }
                        );
                        setRewards((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                        setBanner(`🎉 Redeemed "${rw.title}" for ${rw.payload.costStars} stars!`);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-slate-950 font-extrabold cursor-pointer disabled:opacity-35"
                    >
                      Redeem
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
