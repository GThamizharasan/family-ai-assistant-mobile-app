// Sovereign Gemini Guided Learning & Family Circle Drive Sync Service
// Enables interactive curriculum building, prompt constructors, Socratic lessons, and direct Google Drive sync.

import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';
import { registerAiCreation } from './aiDriveSync';
import { sendMultiTurnChat } from './aiSuite';

export interface LearningDomain {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  color: string;
  bgGradient: string;
  samplePrompts: Array<{
    title: string;
    topic: string;
    recommendedLevel: 'kids' | 'teens' | 'intermediate' | 'expert';
    recommendedStyle: 'socratic' | 'analogies' | 'hands_on_project' | 'executive_summary';
  }>;
}

export const GUIDED_LEARNING_DOMAINS: LearningDomain[] = [
  {
    id: 'stem-robotics',
    name: 'STEM & Robotics Lab',
    category: 'Engineering & Maker',
    description: 'Hands-on robotics, Arduino/ESP32, sensors, circuits, and autonomous obstacle avoidance for young inventors.',
    iconName: 'Bot',
    color: 'text-indigo-400',
    bgGradient: 'from-indigo-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'Obstacle Avoiding Robot',
        topic: 'Build an autonomous 2-wheel robot using Arduino UNO, ultrasonic sensor HC-SR04, and L298N motor driver with full schematic and C++ code.',
        recommendedLevel: 'teens',
        recommendedStyle: 'hands_on_project',
      },
      {
        title: 'How Sensors Talk to Computers',
        topic: 'Explain how ultrasonic and infrared sensors measure distance and convert sound/light bounces into electrical signals using intuitive analogies.',
        recommendedLevel: 'kids',
        recommendedStyle: 'analogies',
      },
      {
        title: 'PID Controller Basics',
        topic: 'Teach the mathematics of Proportional-Integral-Derivative (PID) control for line-following robots in clear, accessible steps.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'socratic',
      },
    ],
  },
  {
    id: 'python-coding',
    name: 'Python & AI Coding for Kids',
    category: 'Computer Science',
    description: 'Step-by-step programming journeys with Pygame, algorithms, variables, and game logic explained like superhero powers.',
    iconName: 'Code',
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'Build a Space Dodger Game',
        topic: 'Create a complete 2D Space Asteroid Dodger game in Python using Pygame with player ship movement, score counter, and collision physics.',
        recommendedLevel: 'kids',
        recommendedStyle: 'hands_on_project',
      },
      {
        title: 'Variables, Loops & If-Else',
        topic: 'Explain programming variables, loops, and conditions using superhero inventory backpacks, training repetitions, and mission decision trees.',
        recommendedLevel: 'kids',
        recommendedStyle: 'analogies',
      },
      {
        title: 'Python Object-Oriented Heroes',
        topic: 'Teach Classes, Objects, and Inheritance by constructing a Superhero battle simulator with custom health, shield, and special attack attributes.',
        recommendedLevel: 'teens',
        recommendedStyle: 'hands_on_project',
      },
    ],
  },
  {
    id: 'ai-foundations',
    name: 'AI & Machine Learning Mastery',
    category: 'Artificial Intelligence',
    description: 'Deep dive into LLMs, neural networks, Transformers, Attention mechanisms, and Agentic AI workflows.',
    iconName: 'Brain',
    color: 'text-purple-400',
    bgGradient: 'from-purple-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'How Transformers Think',
        topic: 'Explain the Transformer architecture, Multi-Head Attention, and Token embeddings using a high-level library metaphor and visual mental models.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'analogies',
      },
      {
        title: 'Prompt Engineering Framework',
        topic: 'Comprehensive guide to Master Prompt Engineering: Zero-shot, Few-shot, Chain-of-Thought, and Meta-Prompting with concrete enterprise templates.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'executive_summary',
      },
      {
        title: 'Build an Autonomous Agent',
        topic: 'Step-by-step masterclass on building autonomous AI agents with tools, memory loops, reflection, and task decomposition.',
        recommendedLevel: 'expert',
        recommendedStyle: 'hands_on_project',
      },
    ],
  },
  {
    id: 'family-finance',
    name: 'Family Wealth & Compounding',
    category: 'Sovereign Finance',
    description: 'Generational wealth, mathematical compounding, index investing, asset allocation, and financial freedom principles.',
    iconName: 'TrendingUp',
    color: 'text-amber-400',
    bgGradient: 'from-amber-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'The Magic of Compounding',
        topic: 'Demonstrate the exponential power of compounding interest starting at age 10 vs age 25 with interactive numerical tables and the Rule of 72.',
        recommendedLevel: 'kids',
        recommendedStyle: 'analogies',
      },
      {
        title: 'Asset Allocation Blueprint',
        topic: 'Design a resilient sovereign family asset allocation framework combining Index Equities, Real Estate, Liquid Buffer, and AI Productivity capital.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'executive_summary',
      },
      {
        title: 'Assets vs Liabilities Game',
        topic: 'Teach children the foundational difference between income-generating assets and cash-draining liabilities using family board game metaphors.',
        recommendedLevel: 'kids',
        recommendedStyle: 'socratic',
      },
    ],
  },
  {
    id: 'deep-space',
    name: 'Cosmos & Quantum Physics',
    category: 'Natural Science',
    description: 'Astrophysics, James Webb telescope discoveries, quantum superposition, and the mechanics of the universe.',
    iconName: 'Sparkles',
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'Inside a Black Hole',
        topic: 'Explore event horizons, gravitational time dilation, and singularity physics as predicted by General Relativity in vivid narrative prose.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'socratic',
      },
      {
        title: 'Quantum Superposition Explained',
        topic: 'Explain quantum superposition and wave-particle duality without confusing jargon using spinning coins and musical harmony analogies.',
        recommendedLevel: 'teens',
        recommendedStyle: 'analogies',
      },
    ],
  },
  {
    id: 'tamil-heritage',
    name: 'Tamil Literature & Heritage',
    category: 'Culture & Linguistics',
    description: 'Classical Thirukkural wisdom, conversational mastery, poetry structures, and cultural philosophy applied to modern leadership.',
    iconName: 'BookOpen',
    color: 'text-orange-400',
    bgGradient: 'from-orange-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'Thirukkural for Leaders',
        topic: 'Analyze 5 key Thirukkural couplets on Decision Making (தெரிந்து செயல்வகை) and Perseverance (ஆள்வினையுடைமை) with modern executive applications.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'executive_summary',
      },
      {
        title: 'Spoken Tamil to Business English',
        topic: 'Bridge everyday Tamil conversation into crisp, authoritative English for professional meetings with side-by-side sentence structures.',
        recommendedLevel: 'teens',
        recommendedStyle: 'hands_on_project',
      },
    ],
  },
  {
    id: 'critical-thinking',
    name: 'Mental Models & First Principles',
    category: 'Cognitive Mastery',
    description: 'Feynman technique, Inversion, Second-order thinking, Pareto principle, and rational decision frameworks.',
    iconName: 'Compass',
    color: 'text-rose-400',
    bgGradient: 'from-rose-900/40 to-slate-900',
    samplePrompts: [
      {
        title: 'First-Principles Deconstruction',
        topic: 'Teach Elon Musk and Aristotle First-Principles Thinking by deconstructing electric battery costs or space travel economics from raw materials up.',
        recommendedLevel: 'intermediate',
        recommendedStyle: 'socratic',
      },
      {
        title: 'The Feynman Learning Technique',
        topic: 'Master the 4-step Feynman Technique: Choose a concept, teach it to a 10-year-old, identify gaps, review and simplify with an exercise.',
        recommendedLevel: 'teens',
        recommendedStyle: 'hands_on_project',
      },
    ],
  },
];

export interface PromptConstructorOptions {
  domainId: string;
  topic: string;
  targetAudience: 'kids' | 'teens' | 'intermediate' | 'expert';
  learningStyle: 'socratic' | 'analogies' | 'hands_on_project' | 'executive_summary';
  lessonDepth: '5_min_concept' | 'deep_dive_masterclass' | 'complete_curriculum';
  language: 'en' | 'ta' | 'tanglish';
  provider?: string;
  model?: string;
}

export interface GuidedLearningLesson {
  id: string;
  title: string;
  domainId: string;
  domainName: string;
  prompt: string;
  constructedPrompt: string;
  content: string;
  summary: string;
  keyTakeaways: string[];
  socraticQuestions: string[];
  practiceChallenge?: string;
  driveSyncStatus: 'synced' | 'pending' | 'local_only' | 'error';
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  createdAt: string;
  userEmail: string;
}

const LOCAL_STORAGE_KEY = 'aura_guided_learning_history';

/**
 * Constructs an optimized master prompt based on selected domain and pedagogical toggles.
 */
export function constructGuidedPrompt(options: PromptConstructorOptions): string {
  const domain = GUIDED_LEARNING_DOMAINS.find((d) => d.id === options.domainId) || GUIDED_LEARNING_DOMAINS[0];

  const audienceDescriptions = {
    kids: 'Target Audience: A curious child or young student (Age 8 to 14). Keep language vivid, highly encouraging, playful, and free of dry academic jargon.',
    teens: 'Target Audience: A bright teenager or high school student. Balance excitement with clear technical substance and relatable modern examples.',
    intermediate: 'Target Audience: A motivated college learner, ambitious professional, or family head seeking practical mastery and applied depth.',
    expert: 'Target Audience: An advanced sovereign technologist or leader seeking deep first-principles rigor, mathematical clarity, and architectural nuances.',
  };

  const styleInstructions = {
    socratic: 'Pedagogical Style: SOCRATIC DIALOGUE. Ask thought-provoking checkpoint questions, stimulate inductive reasoning, and guide the learner to discover insights themselves.',
    analogies: 'Pedagogical Style: INTUITIVE ANALOGIES & MENTAL MODELS. Ground abstract theories in vivid, visual real-world metaphors (architecture, everyday objects, physical sports).',
    hands_on_project: 'Pedagogical Style: HANDS-ON PROJECT-BASED. Provide actionable step-by-step implementation code, experiments, schematics, or concrete exercises that can be completed today.',
    executive_summary: 'Pedagogical Style: EXECUTIVE CHEAT SHEET. High signal-to-noise ratio, structured bullet points, key takeaways, diagrams in markdown, and high-leverage frameworks.',
  };

  const depthInstructions = {
    '5_min_concept': 'Scope: 5-MINUTE CONCEPT SPRINT. Fast, high-energy breakdown of the single most crucial idea, its core mechanism, and why it matters.',
    deep_dive_masterclass: 'Scope: DEEP-DIVE 3-STEP MASTERCLASS. Structured into 3 clear progression milestones: 1) Foundational Intuition, 2) Technical Mechanics / Code, 3) Real-world Application & Edge Cases.',
    complete_curriculum: 'Scope: COMPREHENSIVE CURRICULUM ROADMAP. Provide a full multi-week syllabus with module breakdown, milestones, and project portfolio deliverables.',
  };

  const languageInstructions = {
    en: 'Language: English (Crisp, articulate, inspiring).',
    ta: 'Language: Pure Tamil (தெளிவான தமிழ் விளக்கம், அழகிய உவமைகள், ஆழமான கருத்துக்கள்).',
    tanglish: 'Language: Bilingual / Conversational Tanglish (Natural blend of Tamil and English widely used by modern tech families).',
  };

  return `Topic: ${options.topic || domain.samplePrompts[0].topic}
Domain: ${domain.name} (${domain.category})
${audienceDescriptions[options.targetAudience]}
${styleInstructions[options.learningStyle]}
${depthInstructions[options.lessonDepth]}
${languageInstructions[options.language]}

FORMAT REQUIREMENTS:
Please format your response in elegant, structured GitHub Flavored Markdown:
# [Catchy & Educational Title]
> **Summary & Core Learning Objective**: 2-sentence executive summary.

## 1. 💡 The Core Mental Model & Intuitive Analogy
[Vivid explanation with real-world comparison]

## 2. 🪜 Step-by-Step Interactive Breakdown
[Detailed explanation, technical breakdown, or code/diagrams]

## 3. ❓ Socratic Checkpoint & Reflection Questions
[3 thought-provoking questions with hidden or collapsible answers]

## 4. 🛠️ Hands-On Family Challenge / Mini-Project
[Actionable practical exercise or coding challenge]

## 5. 📝 Key Takeaways & Cheat Sheet
- Bulleted key insights to remember`;
}

/**
 * Generate a complete Guided Learning Masterclass using Gemini.
 */
export async function generateGuidedLesson(
  options: PromptConstructorOptions,
  userEmail = 'chinna.tamil2000@gmail.com',
  accessToken?: string | null
): Promise<GuidedLearningLesson> {
  const constructedPrompt = constructGuidedPrompt(options);
  const domain = GUIDED_LEARNING_DOMAINS.find((d) => d.id === options.domainId) || GUIDED_LEARNING_DOMAINS[0];

  const systemInstruction = `You are the Gemini Sovereign Guided Learning Master Mentor and Curriculum Architect.
You teach with warmth, extreme clarity, intellectual rigor, and infectious curiosity.
Always format your output in clean Markdown with clear headings, bullet points, and practical analogies.
Empower the learner to build real-world intuition, code, and confidence.`;

  // Call Universal multi-turn chat service with chosen provider & model
  const chatResult = await sendMultiTurnChat(
    [{ role: 'user', text: constructedPrompt }],
    {
      role: 'stem_tutor',
      taskComplexity: 'complex',
      customSystemInstruction: systemInstruction,
      provider: options.provider as any,
      model: options.model,
    }
  );

  const content = chatResult.reply || 'No lesson content returned.';

  // Extract title from markdown heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const rawTitle = titleMatch ? titleMatch[1].replace(/[*_#]/g, '').trim() : options.topic || 'Guided Learning Masterclass';
  const cleanTitle = rawTitle.slice(0, 60);

  // Extract summary
  const summaryMatch = content.match(/>\s*\*\*Summary.*?\*\*:\s*([^\n\r]+)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : `${domain.name} interactive masterclass for ${userEmail}.`;

  // Extract takeaways
  const takeawayLines: string[] = [];
  const takeawaysSection = content.split(/##\s*5\./i)[1] || content.split(/Key Takeaways/i)[1];
  if (takeawaysSection) {
    const matches = takeawaysSection.match(/^\s*[-*]\s+(.+)$/gm);
    if (matches) {
      takeawayLines.push(...matches.map((m) => m.replace(/^\s*[-*]\s+/, '').trim()).slice(0, 4));
    }
  }

  // Extract questions
  const questions: string[] = [];
  const questionsSection = content.split(/##\s*3\./i)[1] || '';
  if (questionsSection) {
    const matches = questionsSection.match(/(?:\d+\.|\?)\s*([^\n\r?]+?\?)/g);
    if (matches) {
      questions.push(...matches.map((q) => q.trim()).slice(0, 3));
    }
  }

  const lesson: GuidedLearningLesson = {
    id: `gdl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: cleanTitle,
    domainId: domain.id,
    domainName: domain.name,
    prompt: options.topic,
    constructedPrompt,
    content,
    summary,
    keyTakeaways: takeawayLines.length > 0 ? takeawayLines : ['Mastered foundational mental model', 'Understood interactive mechanics', 'Actionable practical challenge ready'],
    socraticQuestions: questions.length > 0 ? questions : ['What is the core principle behind this topic?', 'How would you explain this in your own words to a friend?'],
    driveSyncStatus: accessToken ? 'pending' : 'local_only',
    createdAt: new Date().toISOString(),
    userEmail,
  };

  // 1. Save to local storage
  saveLessonToLocalHistory(lesson);

  // 2. Automatically sync to Google Drive under "Family Circle / Guided Learning" if token is available
  if (accessToken && accessToken.trim()) {
    try {
      const driveMeta = await syncGuidedLearningToGoogleDrive(lesson, accessToken, userEmail);
      if (driveMeta) {
        lesson.driveFileId = driveMeta.driveFileId;
        lesson.driveWebViewLink = driveMeta.driveWebViewLink;
        lesson.driveFolderPath = driveMeta.folderPath;
        lesson.driveSyncStatus = 'synced';
        saveLessonToLocalHistory(lesson);
      }
    } catch (dErr) {
      console.warn('[GuidedLearning] Google Drive auto-sync notice:', dErr);
      lesson.driveSyncStatus = 'error';
      saveLessonToLocalHistory(lesson);
    }
  }

  return lesson;
}

function utf8ToBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '';
  }
}

/**
 * Uploads a Guided Learning Lesson directly into Google Drive under:
 * "Family Circle / Guided Learning / [Lesson_Title].md"
 */
export async function syncGuidedLearningToGoogleDrive(
  lesson: GuidedLearningLesson,
  accessToken: string,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{ driveFileId: string; driveWebViewLink: string; folderPath: string } | null> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Google access token is missing or expired. Please sign in with Google.');
  }

  try {
    // 1. Get or create "Family Circle" root folder
    const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');

    // 2. Get or create dedicated subfolder: "Guided Learning"
    const guidedLearningFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Guided Learning', familyCircleFolder.id);

    // 3. Prepare Markdown file content and clean filename
    const dateStr = new Date(lesson.createdAt || Date.now()).toISOString().split('T')[0];
    const safeTitle = lesson.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') || 'Lesson';
    const fileName = `Guided_Learning_${safeTitle}_${dateStr}.md`;

    const fileContent = `---
title: "${lesson.title}"
domain: "${lesson.domainName}"
date: "${lesson.createdAt}"
author: "Gemini Sovereign AI Guided Learning"
family_circle_sync: true
user_email: "${userEmail}"
---

${lesson.content}

---
*Synchronized automatically with Google Drive Family Circle / Guided Learning on ${new Date().toLocaleString()}*
`;

    const fileBlob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const contentBase64 = utf8ToBase64(fileContent);

    // 4. Multipart upload directly to Google Drive API v3 (RFC 2387 compliant)
    const boundary = `-------AuraGuidedLearning${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const metadata = {
      name: fileName,
      mimeType: 'text/markdown',
      parents: [guidedLearningFolder.id],
      description: `Gemini Guided Learning Masterclass: ${lesson.title}\nDomain: ${lesson.domainName}\nSynchronized into Family Circle / Guided Learning.`,
    };

    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const bodyBlob = new Blob(
      [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: text/markdown; charset=utf-8\r\n\r\n',
        fileContent,
        closeDelimiter,
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,size,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBlob,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => '');
      if (driveRes.status === 401) {
        throw new Error('Google authorization expired (401). Please re-authenticate your Google account.');
      } else if (driveRes.status === 403) {
        throw new Error('Google Drive write permission denied (403). Please reconnect your Google account with Drive permissions.');
      }
      throw new Error(`Google Drive API error (${driveRes.status}): ${errText}`);
    }

    const driveFile = await driveRes.json();
    const folderPath = 'Family Circle / Guided Learning';
    const driveWebViewLink = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;

    // 4b. Verify parent folder and move if needed
    if (guidedLearningFolder.id && (!driveFile.parents || !driveFile.parents.includes(guidedLearningFolder.id))) {
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${driveFile.id}?addParents=${encodeURIComponent(
            guidedLearningFolder.id
          )}&supportsAllDrives=true&fields=id,parents`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch (pErr) {
        console.warn('[GuidedLearning] Parent folder move warning:', pErr);
      }
    }

    // 5. Mirror to SQLite google_drive_files table for instant appearance in File Explorer & Offline storage
    try {
      await fetch(getApiUrl('/api/google/drive/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driveFile.id,
          userEmail,
          name: fileName,
          mimeType: 'text/markdown',
          size: `${(fileBlob.size / 1024).toFixed(1)} KB`,
          sizeBytes: fileBlob.size,
          webViewLink: driveWebViewLink,
          folderId: guidedLearningFolder.id,
          folderName: folderPath,
          category: 'Guided Learning',
          fileContentBase64: contentBase64,
          uploadedBy: 'gemini_guided_learning',
        }),
      });
    } catch {}

    // 6. Register as an AI Studio creation so it appears in AI Studio history
    try {
      await registerAiCreation(
        {
          id: lesson.id,
          type: 'guided_learning',
          title: lesson.title,
          prompt: lesson.prompt,
          mediaUrl: driveWebViewLink,
          contentPreview: lesson.content.slice(0, 300) + '...',
          modelUsed: 'gemini-2.5-flash',
          mimeType: 'text/markdown',
          driveFileId: driveFile.id,
          driveWebViewLink: driveWebViewLink,
          driveFolderPath: folderPath,
          tags: ['guided-learning', lesson.domainId, 'gemini-tutor'],
        },
        accessToken,
        userEmail
      );
    } catch {}

    return {
      driveFileId: driveFile.id,
      driveWebViewLink,
      folderPath,
    };
  } catch (err: any) {
    console.error('syncGuidedLearningToGoogleDrive failed:', err);
    throw err;
  }
}

/**
 * Universal helper: Sync ANY AI Assistant output (from chat, voice, or studio) directly to Google Drive.
 * Stores in "Family Circle / AI Assistant Outputs" or "Family Circle / Guided Learning".
 */
export async function syncAnyAiOutputToDrive(
  title: string,
  content: string,
  accessToken: string,
  options: {
    folderName?: string;
    category?: string;
    userEmail?: string;
    promptContext?: string;
  } = {}
): Promise<{ driveFileId: string; driveWebViewLink: string; folderPath: string } | null> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Google access token is missing or expired. Please sign in with Google.');
  }
  if (!content) return null;

  const targetSubfolder = options.folderName || 'AI Assistant Outputs';
  const userEmail = options.userEmail || 'chinna.tamil2000@gmail.com';

  try {
    const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');
    const targetFolder = await getOrCreateGoogleDriveFolder(accessToken, targetSubfolder, familyCircleFolder.id);

    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = (title || 'AI_Output').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') || 'Output';
    const fileName = `${safeTitle}_${dateStr}.md`;

    const fileContent = `---
title: "${title || 'Aura AI Assistant Output'}"
date: "${new Date().toISOString()}"
author: "Auro Sovereign AI Assistant"
folder: "Family Circle / ${targetSubfolder}"
user_email: "${userEmail}"
---

${options.promptContext ? `**User Query / Prompt:**\n> ${options.promptContext}\n\n---\n` : ''}

${content}

---
*Synchronized with Google Drive Family Circle / ${targetSubfolder} on ${new Date().toLocaleString()}*
`;

    const fileBlob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const contentBase64 = utf8ToBase64(fileContent);
    const boundary = `-------AuraAiOutput${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

    const metadata = {
      name: fileName,
      mimeType: 'text/markdown',
      parents: [targetFolder.id],
      description: `Auro AI Assistant Output: ${title}\nFolder: Family Circle / ${targetSubfolder}`,
    };

    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const bodyBlob = new Blob(
      [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: text/markdown; charset=utf-8\r\n\r\n',
        fileContent,
        closeDelimiter,
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,size,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBlob,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => '');
      if (driveRes.status === 401) {
        throw new Error('Google authorization expired (401). Please re-authenticate your Google account.');
      } else if (driveRes.status === 403) {
        throw new Error('Google Drive write permission denied (403). Please reconnect your Google account with Drive permissions.');
      }
      throw new Error(`Drive upload error (${driveRes.status}): ${errText}`);
    }

    const driveFile = await driveRes.json();
    const folderPath = `Family Circle / ${targetSubfolder}`;
    const driveWebViewLink = driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`;

    // Verify parent and move if needed
    if (targetFolder.id && (!driveFile.parents || !driveFile.parents.includes(targetFolder.id))) {
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${driveFile.id}?addParents=${encodeURIComponent(
            targetFolder.id
          )}&supportsAllDrives=true&fields=id,parents`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch (pErr) {
        console.warn('[AiOutput] Parent folder move warning:', pErr);
      }
    }

    // Mirror to server SQLite
    try {
      await fetch(getApiUrl('/api/google/drive/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driveFile.id,
          userEmail,
          name: fileName,
          mimeType: 'text/markdown',
          size: `${(fileBlob.size / 1024).toFixed(1)} KB`,
          sizeBytes: fileBlob.size,
          webViewLink: driveWebViewLink,
          folderId: targetFolder.id,
          folderName: folderPath,
          category: options.category || 'AI Assistant',
          fileContentBase64: contentBase64,
          uploadedBy: 'auro_ai_assistant',
        }),
      });
    } catch {}

    return {
      driveFileId: driveFile.id,
      driveWebViewLink,
      folderPath,
    };
  } catch (err: any) {
    console.error('syncAnyAiOutputToDrive failed:', err);
    throw err;
  }
}

/**
 * Local History Management
 */
export function getLocalGuidedLearningHistory(): GuidedLearningLesson[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLessonToLocalHistory(lesson: GuidedLearningLesson): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getLocalGuidedLearningHistory();
    const filtered = history.filter((l) => l.id !== lesson.id);
    const updated = [lesson, ...filtered].slice(0, 50);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[GuidedLearning] Local storage write notice:', e);
  }
}
