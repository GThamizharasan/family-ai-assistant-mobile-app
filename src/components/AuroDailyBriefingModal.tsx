import React, { useEffect, useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Volume2,
  Sparkles,
  Bell,
  CheckSquare,
  ShieldAlert,
  Star,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { callFamilyLifeAi, loadFamilyLifeRecords } from '../services/familyLifeSuiteService';
import { createReminder, getLocalReminders } from '../services/reminderDriveSync';
import { loadSmartDocuments } from '../services/smartDocumentAiService';
import { speechEngine } from '../services/speech';

interface AuroDailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuroDailyBriefingModal: React.FC<AuroDailyBriefingModalProps> = ({ isOpen, onClose }) => {
  const { user, tasks, googleAccessToken } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';
  const isEvening = new Date().getHours() >= 17;

  const [loading, setLoading] = useState(false);
  const [headlineEn, setHeadlineEn] = useState('');
  const [headlineTa, setHeadlineTa] = useState('');
  const [spokenEn, setSpokenEn] = useState('');
  const [spokenTa, setSpokenTa] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [wellnessNudge, setWellnessNudge] = useState('');
  const [stats, setStats] = useState({
    pendingTasks: 0,
    dueReminders: 0,
    expiringSoon: 0,
    kidsStars: 0,
  });
  const [scheduledToast, setScheduledToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const buildDigest = async () => {
      setLoading(true);
      try {
        const [suiteRecords, smartDocs] = await Promise.all([
          loadFamilyLifeRecords(undefined, { userEmail, includeDrive: false }),
          loadSmartDocuments(userEmail, null, false),
        ]);
        const reminders = getLocalReminders();
        const pendingTasksList = (tasks || []).filter((t) => !t.completed);

        const within60Days = (iso?: string | null) => {
          if (!iso) return false;
          const diff = (new Date(iso).getTime() - Date.now()) / 86_400_000;
          return diff >= -7 && diff <= 60;
        };

        const expiringIds = suiteRecords.filter((r) => r.domain === 'identity_doc' && within60Days(r.dueOrExpiryDate));
        const expiringDocs = smartDocs.filter((d) => within60Days(d.expiryOrDueDate));
        const habits = suiteRecords.filter((r) => r.domain === 'chore_habit');
        const stars = habits.reduce(
          (s, h) => s + (h.payload?.completedDates?.length || 0) * (h.payload?.starsReward || 5),
          0
        );

        const nextStats = {
          pendingTasks: pendingTasksList.length,
          dueReminders: reminders.filter((r) => !r.completed).length,
          expiringSoon: expiringIds.length + expiringDocs.length,
          kidsStars: stars,
        };
        if (!cancelled) setStats(nextStats);

        const contextSummary = [
          `Time of day: ${isEvening ? 'Evening Wrap-Up' : 'Morning Briefing'}`,
          `User: ${user?.name || 'Family'}`,
          `Pending Tasks (${nextStats.pendingTasks}): ${pendingTasksList.slice(0, 3).map((t) => t.title).join(', ') || 'All clear'}`,
          `Active Reminders (${nextStats.dueReminders}): ${reminders.slice(0, 3).map((r) => r.title).join(', ') || 'None'}`,
          `Expiring IDs/Bills/Warranties (${nextStats.expiringSoon}): ${[...expiringIds, ...expiringDocs].slice(0, 3).map((x) => x.title).join(', ') || 'None'}`,
          `Kids Star Streak: ${stars} stars`,
        ].join('\n');

        const ai = await callFamilyLifeAi<any>({
          mode: 'morning_briefing',
          promptContext: contextSummary,
        });

        if (cancelled) return;

        if (ai.result) {
          setHeadlineEn(ai.result.headlineEnglish || (isEvening ? 'Good Evening, Family!' : 'Good Morning, Family!'));
          setHeadlineTa(ai.result.headlineTamil || (isEvening ? 'இனிய மாலை வணக்கம்!' : 'இனிய காலை வணக்கம்!'));
          setSpokenEn(ai.result.spokenEnglish || '');
          setSpokenTa(ai.result.spokenTamil || '');
          setPriorities(Array.isArray(ai.result.topPriorities) ? ai.result.topPriorities : []);
          setWellnessNudge(ai.result.wellnessNudge || 'Stay hydrated and celebrate small family wins today!');
        } else {
          setHeadlineEn(isEvening ? `Good Evening, ${user?.name || 'Family'}!` : `Good Morning, ${user?.name || 'Family'}!`);
          setHeadlineTa(isEvening ? 'இனிய மாலை வணக்கம்! இன்றைய குடும்ப சுருக்கம்' : 'இனிய காலை வணக்கம்! இன்றைய முக்கிய நிகழ்வுகள்');
          setSpokenEn(
            `You have ${nextStats.pendingTasks} pending task(s), ${nextStats.dueReminders} active reminder(s), and ${nextStats.expiringSoon} upcoming bill or ID renewal(s). Kids have earned ${stars} stars so far!`
          );
          setSpokenTa(
            `இன்று ${nextStats.pendingTasks} பணிகளும், ${nextStats.dueReminders} நினைவூட்டல்களும் உள்ளன. குழந்தைகள் இதுவரை ${stars} நட்சத்திரங்களைப் பெற்றுள்ளனர்!`
          );
          setPriorities([
            pendingTasksList[0]?.title ? `Complete task: ${pendingTasksList[0].title}` : 'Review today’s family schedule & meals',
            reminders[0]?.title ? `Reminder: ${reminders[0].title}` : 'Check medications & hydration goals',
            nextStats.expiringSoon > 0 ? `Review ${nextStats.expiringSoon} upcoming bill/warranty/ID renewal(s)` : '15 mins English/தமிழ் or Kids Maths practice',
          ]);
          setWellnessNudge('Drink a glass of water now and take a 15-minute family walk today!');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void buildDigest();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEvening, tasks, user?.name, userEmail]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/88 backdrop-blur-lg flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-amber-400/35 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-r from-amber-950/90 via-slate-900 to-indigo-950/90 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg">
              {isEvening ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-amber-300">
                ✨ Auro Proactive {isEvening ? 'Evening Wrap-Up' : 'Morning Family Briefing'} (EN + தமிழ்)
              </span>
              <h3 className="text-lg font-black text-white">{headlineEn || 'Preparing Family Digest...'}</h3>
              {headlineTa && <div className="text-xs text-amber-200 font-bold">{headlineTa}</div>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs text-white">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-2 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span>Synthesizing tasks, reminders, renewals, health & kids streak...</span>
            </div>
          ) : (
            <>
              {/* Live Pulse Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-950 border border-white/10">
                  <CheckSquare className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="text-xl font-black">{stats.pendingTasks}</div>
                  <div className="text-[10px] text-slate-400">Pending Tasks</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-white/10">
                  <Bell className="w-4 h-4 text-rose-400 mb-1" />
                  <div className="text-xl font-black">{stats.dueReminders}</div>
                  <div className="text-[10px] text-slate-400">Active Reminders</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-white/10">
                  <ShieldAlert className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="text-xl font-black">{stats.expiringSoon}</div>
                  <div className="text-[10px] text-slate-400">Upcoming Renewals</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-white/10">
                  <Star className="w-4 h-4 text-emerald-400 mb-1" />
                  <div className="text-xl font-black">⭐ {stats.kidsStars}</div>
                  <div className="text-[10px] text-slate-400">Kids Star Streak</div>
                </div>
              </div>

              {/* Bilingual Digest */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 space-y-1">
                  <div className="text-[10px] font-black uppercase text-cyan-300">English Digest</div>
                  <p className="text-slate-200 leading-relaxed">{spokenEn}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 space-y-1">
                  <div className="text-[10px] font-black uppercase text-amber-300">தமிழ் சுருக்கம்</div>
                  <p className="text-amber-100 leading-relaxed">{spokenTa}</p>
                </div>
              </div>

              {/* Top Priorities */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 space-y-1.5">
                <div className="text-[10px] font-black uppercase text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Today&apos;s Top Family Priorities
                </div>
                {priorities.map((p, i) => (
                  <div key={i} className="text-slate-200">
                    {i + 1}. {p}
                  </div>
                ))}
                {wellnessNudge && <div className="text-cyan-300 pt-1 font-semibold">💧 {wellnessNudge}</div>}
              </div>

              {scheduledToast && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">
                  {scheduledToast}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => speechEngine.speak(`${spokenEn} ${spokenTa}`)}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <Volume2 className="w-4 h-4" /> Speak Full Briefing (EN + தமிழ்)
                </button>
                <button
                  onClick={async () => {
                    await createReminder(
                      {
                        title: '☀️ Auro Daily Morning Family Briefing (EN + தமிழ்)',
                        dueTime: '07:30',
                        category: 'family',
                        priority: 'medium',
                        notes: 'Open Home Hub -> Daily Briefing for tasks, meds, renewals & weather.',
                      },
                      googleAccessToken,
                      userEmail
                    );
                    setScheduledToast('✅ Scheduled daily 07:30 AM Family Briefing reminder!');
                  }}
                  className="py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-4 h-4" /> Schedule 07:30 AM Daily
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
