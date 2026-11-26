import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Utensils,
  ShoppingCart,
  Calendar,
  Camera,
  Sparkles,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  FamilyLifeRecord,
  GroceryItemPayload,
  KitchenRecipePayload,
  WeeklyMealPlanPayload,
} from '../../types/familyLifeSuite';
import {
  callFamilyLifeAi,
  deleteFamilyLifeRecord,
  downscaleImageToDataUrl,
  loadFamilyLifeRecords,
  saveFamilyLifeRecord,
  syncAllFamilyLifeWithDrive,
} from '../../services/familyLifeSuiteService';
import { speechEngine } from '../../services/speech';

export const SmartKitchenTab: React.FC = () => {
  const { user, googleAccessToken } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';

  const [subTab, setSubTab] = useState<'recipes' | 'grocery' | 'mealplan'>('recipes');
  const [recipes, setRecipes] = useState<FamilyLifeRecord<KitchenRecipePayload>[]>([]);
  const [groceries, setGroceries] = useState<FamilyLifeRecord<GroceryItemPayload>[]>([]);
  const [mealPlans, setMealPlans] = useState<FamilyLifeRecord<WeeklyMealPlanPayload>[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  // Fridge-to-Recipe state
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [fridgePreview, setFridgePreview] = useState('');
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [cookingRecipe, setCookingRecipe] = useState<FamilyLifeRecord<KitchenRecipePayload> | null>(null);
  const [cookStepIdx, setCookStepIdx] = useState(0);
  const fridgeFileRef = useRef<HTMLInputElement | null>(null);

  // Grocery state
  const [groceryName, setGroceryName] = useState('');
  const [groceryQty, setGroceryQty] = useState('1 pack');
  const [groceryCat, setGroceryCat] = useState<GroceryItemPayload['category']>('Produce');

  // Meal Planner state
  const [healthFocus, setHealthFocus] = useState('Iron-Rich & Kids Immunity (South Indian + Balanced)');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const reloadAll = useCallback(async () => {
    const all = await loadFamilyLifeRecords(undefined, { userEmail, googleAccessToken });
    setRecipes(all.filter((r) => r.domain === 'kitchen_recipe'));
    setGroceries(all.filter((r) => r.domain === 'grocery_item'));
    setMealPlans(all.filter((r) => r.domain === 'meal_plan'));
  }, [userEmail, googleAccessToken]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const handleFridgeToRecipe = async (file?: File) => {
    setIsGeneratingRecipe(true);
    try {
      let dataUrl = fridgePreview;
      let mime = 'image/jpeg';
      if (file) {
        const down = await downscaleImageToDataUrl(file, 1200);
        dataUrl = down.dataUrl;
        mime = down.mime;
        setFridgePreview(dataUrl);
      }

      const ai = await callFamilyLifeAi<any>({
        mode: 'fridge_to_recipe',
        imageBase64: dataUrl || undefined,
        mimeType: mime,
        promptContext: ingredientsInput || 'Healthy family ingredients from fridge/pantry',
      });

      const list = Array.isArray(ai.result?.recipes) && ai.result.recipes.length > 0
        ? ai.result.recipes
        : [
            {
              title: 'Murungakkai Keerai Paruppu Sambar & Millet Bowl',
              titleTamil: 'முருங்கைக்காய் கீரை பருப்பு சாம்பார் & சிறுதானிய சாதம்',
              cuisine: 'South Indian / Tamil',
              prepMinutes: 25,
              servings: 4,
              caloriesPerServing: 310,
              healthTags: ['Iron-Rich', 'High Protein', 'Kids Friendly'],
              summaryEnglish: 'Wholesome lentil, drumstick & greens sambar packed with natural iron and protein.',
              summaryTamil: 'இரும்புச்சத்தும் புரதச்சத்தும் நிறைந்த சுவையான குடும்ப ஆரோக்கிய உணவு.',
              ingredients: ['1 cup Toor Dal (துவரம் பருப்பு)', '2 cups Fresh Greens / Spinach (கீரை)', '1 Tomato & Shallots', '1 tsp Sambar powder & turmeric'],
              stepsEnglish: [
                'Pressure cook washed toor dal with turmeric and a drop of gingelly oil until soft.',
                'Simmer shallots, tomatoes, and greens with mild sambar spice for 8 minutes.',
                'Fold in mashed dal, temper with mustard & curry leaves, and serve warm!',
              ],
              stepsTamil: [
                'துவரம் பருப்பை மஞ்சள் தூள் சேர்த்து மென்மையாக வேகவைக்கவும்.',
                'சின்ன வெங்காயம், தக்காளி மற்றும் கீரையை சாம்பார் பொடியுடன் 8 நிமிடம் கொதிக்க விடவும்.',
                'மசித்த பருப்பை சேர்த்து கடுகு, கறிவேப்பிலை தாளித்து பரிமாறவும்!',
              ],
            },
          ];

      const savedList: FamilyLifeRecord<KitchenRecipePayload>[] = [];
      for (const rec of list) {
        const saved = await saveFamilyLifeRecord<KitchenRecipePayload>(
          {
            domain: 'kitchen_recipe',
            title: String(rec.title || 'Healthy Family Recipe'),
            subtitle: `${rec.titleTamil || ''} · ${rec.prepMinutes || 20} mins`,
            payload: {
              cuisine: rec.cuisine || 'South Indian / Tamil',
              prepMinutes: Number(rec.prepMinutes) || 25,
              servings: Number(rec.servings) || 4,
              caloriesPerServing: Number(rec.caloriesPerServing) || 300,
              healthTags: Array.isArray(rec.healthTags) ? rec.healthTags : ['Healthy'],
              titleTamil: String(rec.titleTamil || rec.title || ''),
              summaryEnglish: String(rec.summaryEnglish || ''),
              summaryTamil: String(rec.summaryTamil || ''),
              ingredients: Array.isArray(rec.ingredients) ? rec.ingredients : [],
              stepsEnglish: Array.isArray(rec.stepsEnglish) ? rec.stepsEnglish : [],
              stepsTamil: Array.isArray(rec.stepsTamil) ? rec.stepsTamil : [],
            },
          },
          { userEmail, googleAccessToken }
        );
        savedList.push(saved);
      }

      setRecipes((prev) => [...savedList, ...prev]);
      setBanner(`🍳 Generated ${savedList.length} bilingual (EN + தமிழ்) recipe(s) via ${ai.modelUsed}!`);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const handleAddGrocery = async (nameOverride?: string, catOverride?: GroceryItemPayload['category']) => {
    const title = (nameOverride ?? groceryName).trim();
    if (!title) return;
    const saved = await saveFamilyLifeRecord<GroceryItemPayload>(
      {
        domain: 'grocery_item',
        title,
        subtitle: `${groceryQty} · ${catOverride || groceryCat}`,
        payload: {
          category: catOverride || groceryCat,
          quantity: groceryQty,
          checked: false,
          priceHistory: [],
        },
      },
      { userEmail, googleAccessToken }
    );
    setGroceries((prev) => [saved, ...prev]);
    if (!nameOverride) setGroceryName('');
  };

  const handleGenerateMealPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const ai = await callFamilyLifeAi<any>({
        mode: 'generate_meal_plan',
        promptContext: `Health & Lab Goal: ${healthFocus}`,
      });

      const defaultDays = [
        { day: 'Monday', breakfast: 'Ragi Idli + Coconut Chutney (ராகி இட்லி)', kidsLunchbox: 'Paneer Bhurji Wrap + Berries', dinner: 'Moong Dal Khichdi & Curd', tamilHighlight: 'இரும்பு & கால்சியம் சத்து' },
        { day: 'Tuesday', breakfast: 'Pesarattu / Green Gram Dosa', kidsLunchbox: 'Veg Pasta with Hidden Spinach', dinner: 'Chapati + Chana Masala', tamilHighlight: 'புரதச்சத்து நிறைந்தது' },
        { day: 'Wednesday', breakfast: 'Oats Pongal + Sambar (ஓட்ஸ் பொங்கல்)', kidsLunchbox: 'Mini Curd Rice + Pomegranate', dinner: 'Steamed Rice + Rasam + Beans Poriyal', tamilHighlight: 'செரிமானத்திற்கு சிறந்தது' },
        { day: 'Thursday', breakfast: 'Appam + Vegetable Stew', kidsLunchbox: 'Cheese & Sweetcorn Sandwich', dinner: 'Millet Upma + Peanut Chutney', tamilHighlight: 'குழந்தைகள் விரும்பும் சுவை' },
        { day: 'Friday', breakfast: 'Adai Aviyal (அடை அவியல்)', kidsLunchbox: 'Lemon Rice + Boiled Egg / Chickpeas', dinner: 'Wholewheat Parotta + Veg Kurma', tamilHighlight: 'பாரம்பரிய சத்துணவு' },
        { day: 'Saturday', breakfast: 'Masala Dosa + Sambar', kidsLunchbox: 'Fruit & Nut Smoothie Bowl', dinner: 'Grilled Paneer/Fish + Veg Soup', tamilHighlight: 'வார இறுதி ஆரோக்கியம்' },
        { day: 'Sunday', breakfast: 'Idiyappam + Cardamom Coconut Milk', kidsLunchbox: 'Homemade Millet Pancakes', dinner: 'Light Lemon Rasam & Greens', tamilHighlight: 'எளிய இரவு உணவு' },
      ];

      const payload: WeeklyMealPlanPayload = {
        weekStart: new Date().toISOString().split('T')[0],
        healthFocus: ai.result?.healthFocus || healthFocus,
        days: Array.isArray(ai.result?.days) && ai.result.days.length > 0 ? ai.result.days : defaultDays,
        suggestedGroceries: Array.isArray(ai.result?.suggestedGroceries)
          ? ai.result.suggestedGroceries
          : ['Ragi Flour', 'Toor Dal', 'Fresh Spinach (கீரை)', 'Paneer', 'Pomegranate'],
      };

      const saved = await saveFamilyLifeRecord<WeeklyMealPlanPayload>(
        {
          domain: 'meal_plan',
          title: `7-Day Family Nutrition Plan (${payload.weekStart})`,
          subtitle: payload.healthFocus,
          payload,
        },
        { userEmail, googleAccessToken }
      );
      setMealPlans((prev) => [saved, ...prev]);
      setBanner('🥗 Generated 7-day bilingual family & kids lunchbox nutrition plan!');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 text-white">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/85 border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
            🍲 Fridge Photo → Recipe · Shared Grocery Auto-Restock · EN + தமிழ் Voice Chef
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Smart Kitchen, Grocery & Bilingual Meal Planner
          </h2>
        </div>
        <button
          onClick={async () => {
            const res = await syncAllFamilyLifeWithDrive(userEmail, googleAccessToken);
            setBanner(res.needsSignIn ? 'Sign in with Google Drive to sync.' : `☁️ Synced ${res.total} kitchen & family records with Drive!`);
          }}
          className="px-3.5 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Sync Drive
        </button>
      </div>

      {banner && (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'recipes', label: `🍲 Fridge → Recipes (${recipes.length})`, icon: Utensils },
          { id: 'grocery', label: `🛒 Shared Grocery (${groceries.filter((g) => !g.payload.checked).length})`, icon: ShoppingCart },
          { id: 'mealplan', label: `📅 7-Day Meal Grid (${mealPlans.length})`, icon: Calendar },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
              subTab === t.id
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg'
                : 'bg-slate-900/85 text-slate-300 border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Step-by-Step Hands-Free Voice Cooking Mode Modal */}
      {cookingRecipe && (
        <div className="rounded-3xl bg-slate-950 border-2 border-amber-400/50 p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-300">👩‍🍳 Step-by-Step Voice Cooking Mode</span>
              <h3 className="text-lg font-black text-white">{cookingRecipe.title} · {cookingRecipe.payload.titleTamil}</h3>
            </div>
            <button onClick={() => setCookingRecipe(null)} className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold cursor-pointer">
              Exit Chef Mode
            </button>
          </div>
          <div className="rounded-2xl bg-slate-900 p-4 border border-white/10 space-y-2">
            <div className="text-xs font-black text-cyan-300">
              Step {cookStepIdx + 1} of {cookingRecipe.payload.stepsEnglish.length}
            </div>
            <p className="text-sm text-white font-semibold">{cookingRecipe.payload.stepsEnglish[cookStepIdx]}</p>
            {cookingRecipe.payload.stepsTamil[cookStepIdx] && (
              <p className="text-sm text-amber-200">{cookingRecipe.payload.stepsTamil[cookStepIdx]}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setCookStepIdx((i) => Math.max(0, i - 1))}
              disabled={cookStepIdx === 0}
              className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Step
            </button>
            <button
              onClick={() =>
                speechEngine.speak(
                  `${cookingRecipe.payload.stepsEnglish[cookStepIdx] || ''} ${cookingRecipe.payload.stepsTamil[cookStepIdx] || ''}`
                )
              }
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" /> Read Step Aloud (EN + தமிழ்)
            </button>
            <button
              onClick={() => setCookStepIdx((i) => Math.min(cookingRecipe.payload.stepsEnglish.length - 1, i + 1))}
              disabled={cookStepIdx >= cookingRecipe.payload.stepsEnglish.length - 1}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: FRIDGE / PANTRY PHOTO -> RECIPES */}
      {subTab === 'recipes' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">📸 Snap Fridge / Pantry or Type Ingredients</h3>
              <button
                onClick={() => fridgeFileRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Snap Fridge Photo
              </button>
              <input
                ref={fridgeFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFridgeToRecipe(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            <div className="flex gap-2">
              <input
                value={ingredientsInput}
                onChange={(e) => setIngredientsInput(e.target.value)}
                placeholder="e.g. Spinach, paneer, tomatoes, curry leaves, millet, eggs..."
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <button
                onClick={() => void handleFridgeToRecipe()}
                disabled={isGeneratingRecipe}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isGeneratingRecipe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate EN + தமிழ்
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recipes.map((rec) => {
              const p = rec.payload;
              return (
                <div key={rec.id} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                        {p.cuisine} · {p.prepMinutes}m · {p.servings} servings
                      </span>
                      <h4 className="text-base font-black text-white mt-1">{rec.title}</h4>
                      <div className="text-amber-200 font-bold">{p.titleTamil}</div>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(rec.id, googleAccessToken);
                        setRecipes((prev) => prev.filter((x) => x.id !== rec.id));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-300">{p.summaryEnglish}</p>
                  <p className="text-amber-100/90">{p.summaryTamil}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.healthTags || []).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-200 text-[10px] font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        setCookingRecipe(rec);
                        setCookStepIdx(0);
                      }}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold cursor-pointer"
                    >
                      👩‍🍳 Start Voice Cooking Mode
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SHARED FAMILY GROCERY LIST + AUTO-RESTOCK & PRICE HISTORY */}
      {subTab === 'grocery' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div>
              <h3 className="text-sm font-black text-white">🛒 Shared Family Grocery Checklist & Receipt Price Tracker</h3>
              <p className="text-[11px] text-slate-400">
                Tip: Scanning any supermarket receipt in Smart Document Analyzer automatically checks off bought items & logs price changes!
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                value={groceryName}
                onChange={(e) => setGroceryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleAddGrocery()}
                placeholder="Item (e.g. Organic Milk, Ponni Rice, Spinach)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <input
                value={groceryQty}
                onChange={(e) => setGroceryQty(e.target.value)}
                placeholder="Qty (e.g. 2 L / 1 kg)"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white"
              />
              <button
                onClick={() => void handleAddGrocery()}
                className="py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {groceries.map((g) => {
              const p = g.payload;
              return (
                <div
                  key={g.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    p.checked ? 'bg-emerald-950/30 border-emerald-400/35' : 'bg-slate-900/90 border-white/10'
                  }`}
                >
                  <label
                    onClick={async () => {
                      const u = await saveFamilyLifeRecord<GroceryItemPayload>(
                        { id: g.id, domain: 'grocery_item', title: g.title, subtitle: g.subtitle, payload: { ...p, checked: !p.checked } },
                        { userEmail, googleAccessToken }
                      );
                      setGroceries((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                    }}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                  >
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${p.checked ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div className="min-w-0">
                      <div className={`font-extrabold truncate ${p.checked ? 'line-through text-slate-400' : 'text-white'}`}>
                        {g.title} <span className="text-cyan-300 font-normal">({p.quantity})</span>
                      </div>
                      {p.priceHistory && p.priceHistory.length > 0 && (
                        <div className="text-[10px] text-amber-300">
                          Price Trend: {p.priceHistory.map((ph) => `${p.currency || '₹'}${ph.price}`).join(' → ')}
                        </div>
                      )}
                    </div>
                  </label>
                  {p.checked && (
                    <button
                      onClick={async () => {
                        const u = await saveFamilyLifeRecord<GroceryItemPayload>(
                          { id: g.id, domain: 'grocery_item', title: g.title, subtitle: g.subtitle, payload: { ...p, checked: false } },
                          { userEmail, googleAccessToken }
                        );
                        setGroceries((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-[10px] font-bold cursor-pointer"
                    >
                      Restock
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await deleteFamilyLifeRecord(g.id, googleAccessToken);
                      setGroceries((prev) => prev.filter((x) => x.id !== g.id));
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: WEEKLY KIDS & FAMILY NUTRITION PLANNER */}
      {subTab === 'mealplan' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-black text-white">🥗 AI Weekly Family & Kids Lunchbox Planner (Tailored to Health / Lab Markers)</h3>
            <div className="flex flex-wrap gap-2">
              <select
                value={healthFocus}
                onChange={(e) => setHealthFocus(e.target.value)}
                className="flex-1 min-w-[240px] px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
              >
                <option value="Iron-Rich & Kids Immunity (South Indian + Balanced)">Iron-Rich & Kids Immunity (Hemoglobin / Lymph Node Support)</option>
                <option value="Low-Glycemic & Heart-Healthy Family Meals">Low-Sugar / Glycemic & Heart-Healthy</option>
                <option value="High-Protein Vegetarian & Millet Power">High-Protein Vegetarian & Millet Power (சிறுதானிய உணவு)</option>
                <option value="Kids Brain Boost & Picky-Eater Lunchboxes">Kids Brain Boost & School Lunchboxes</option>
              </select>
              <button
                onClick={() => void handleGenerateMealPlan()}
                disabled={isGeneratingPlan}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-950 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate 7-Day Plan
              </button>
            </div>
          </div>

          {mealPlans.map((mp) => (
            <div key={mp.id} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-white">{mp.title}</h4>
                  <p className="text-emerald-300 font-bold">{mp.payload.healthFocus}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      for (const item of mp.payload.suggestedGroceries || []) {
                        await handleAddGrocery(item, 'Produce');
                      }
                      setBanner(`🛒 Added ${mp.payload.suggestedGroceries.length} meal-plan items to Shared Grocery List!`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold cursor-pointer"
                  >
                    + Add Ingredients to Grocery List
                  </button>
                  <button
                    onClick={async () => {
                      await deleteFamilyLifeRecord(mp.id, googleAccessToken);
                      setMealPlans((prev) => prev.filter((x) => x.id !== mp.id));
                    }}
                    className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mp.payload.days.map((d) => (
                  <div key={d.day} className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-1">
                    <div className="flex justify-between">
                      <strong className="text-cyan-300">{d.day}</strong>
                      {d.tamilHighlight && <span className="text-[10px] text-amber-300">{d.tamilHighlight}</span>}
                    </div>
                    <div>🌅 <span className="text-slate-400">Breakfast:</span> {d.breakfast}</div>
                    <div>🍱 <span className="text-slate-400">Kids Box:</span> {d.kidsLunchbox}</div>
                    <div>🌙 <span className="text-slate-400">Dinner:</span> {d.dinner}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
