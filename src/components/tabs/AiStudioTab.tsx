import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  GraduationCap,
  BookOpen,
  Mic,
  MicOff,
  Video,
  Music,
  Image as ImageIcon,
  MessageSquare,
  Radio,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Send,
  Upload,
  AlertCircle,
  Clock,
  Layers,
  Wand2,
  ChevronRight,
  ExternalLink,
  Cloud,
  Bot,
  Brain,
  Zap,
  Volume2,
  FileText,
  Search,
  Maximize2,
  Share2,
  HardDrive,
  FolderArchive,
  Cpu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AVAILABLE_NVIDIA_MODELS, AiProvider } from '../../types';
import {
  getActiveAiProvider,
  getActiveAiModel,
  getModelDisplayName,
  AI_MODEL_CHANGED_EVENT,
} from '../../services/aiConfig';
import { AiModelConfigModal } from '../AiModelConfigModal';
import { AiCreationsHistoryDashboard } from '../ai/AiCreationsHistoryDashboard';
import { registerAiCreation, uploadAiCreationToGoogleDrive } from '../../services/aiDriveSync';
import { AiStudioCreation } from '../../types/aiCreation';
import {
  transcribeAudio,
  generateVideoFromText,
  animateImageToVideo,
  pollVideoOperation,
  fetchCompletedVideoBlob,
  sendMultiTurnChat,
  generateMusic,
  generateOrEditImage,
  converseLiveTurn,
  CHAT_ROLES,
  ChatMessage,
  blobToBase64,
} from '../../services/aiSuite';
import { speechEngine } from '../../services/speech';
import {
  GUIDED_LEARNING_DOMAINS,
  PromptConstructorOptions,
  GuidedLearningLesson,
  constructGuidedPrompt,
  generateGuidedLesson,
  syncGuidedLearningToGoogleDrive,
  getLocalGuidedLearningHistory,
} from '../../services/guidedLearningService';

export type AiStudioSubTab =
  | 'overview'
  | 'guided-learning'
  | 'transcribe'
  | 'veo-video'
  | 'veo-animate'
  | 'chat'
  | 'music'
  | 'images'
  | 'live-voice'
  | 'history';

interface AiStudioTabProps {
  initialSubTab?: AiStudioSubTab;
  onOpenVoiceAssistant?: () => void;
}

export const AiStudioTab: React.FC<AiStudioTabProps> = ({
  initialSubTab = 'overview',
  onOpenVoiceAssistant,
}) => {
  const { user, googleAccessToken, signInWithGoogleOAuth } = useApp();
  const [activeTab, setActiveTab] = useState<AiStudioSubTab>(initialSubTab);

  // ----------------------------------------------------
  // Guided Learning State & Constructors
  // ----------------------------------------------------
  const [guidedDomainId, setGuidedDomainId] = useState<string>('stem-robotics');
  const [guidedTopic, setGuidedTopic] = useState<string>('');
  const [guidedAudience, setGuidedAudience] = useState<'kids' | 'teens' | 'intermediate' | 'expert'>('teens');
  const [guidedStyle, setGuidedStyle] = useState<'socratic' | 'analogies' | 'hands_on_project' | 'executive_summary'>('hands_on_project');
  const [guidedDepth, setGuidedDepth] = useState<'5_min_concept' | 'deep_dive_masterclass' | 'complete_curriculum'>('deep_dive_masterclass');
  const [guidedLanguage, setGuidedLanguage] = useState<'en' | 'ta' | 'tanglish'>('en');
  const [constructedPromptPreview, setConstructedPromptPreview] = useState<string>('');
  const [isGeneratingLesson, setIsGeneratingLesson] = useState<boolean>(false);
  const [currentLesson, setCurrentLesson] = useState<GuidedLearningLesson | null>(null);
  const [isSyncingLessonToDrive, setIsSyncingLessonToDrive] = useState<boolean>(false);
  const [lessonDriveNotice, setLessonDriveNotice] = useState<string | null>(null);
  const [isPlayingLessonAudio, setIsPlayingLessonAudio] = useState<boolean>(false);
  const [guidedHistory, setGuidedHistory] = useState<GuidedLearningLesson[]>(() => getLocalGuidedLearningHistory());

  const selectedDomain = GUIDED_LEARNING_DOMAINS.find((d) => d.id === guidedDomainId) || GUIDED_LEARNING_DOMAINS[0];

  const handleReadLessonAloud = () => {
    if (!currentLesson) return;
    if (isPlayingLessonAudio) {
      speechEngine.stopSpeaking();
      setIsPlayingLessonAudio(false);
      return;
    }
    const textToSpeak = `${currentLesson.title}. Summary: ${currentLesson.summary}. ${currentLesson.keyTakeaways.join('. ')}.`;
    setIsPlayingLessonAudio(true);
    speechEngine.speak(textToSpeak, {
      onEnd: () => setIsPlayingLessonAudio(false),
    });
  };

  const handleSyncLessonToDrive = async () => {
    if (!currentLesson) return;
    let token = googleAccessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);
    if (!token) {
      setLessonDriveNotice('Connecting Google Account for Drive sync...');
      const authed = await signInWithGoogleOAuth();
      if (authed) {
        token = (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null) || googleAccessToken;
      }
    }
    if (!token) {
      setLessonDriveNotice('Google Sign-In required to sync directly to Google Drive Family Circle.');
      return;
    }
    setIsSyncingLessonToDrive(true);
    setLessonDriveNotice(null);
    try {
      let res;
      try {
        res = await syncGuidedLearningToGoogleDrive(currentLesson, token, user.email);
      } catch (firstErr: any) {
        if (firstErr?.message?.includes('401') || firstErr?.message?.includes('expired')) {
          setLessonDriveNotice('Refreshing Google authorization...');
          const reauthed = await signInWithGoogleOAuth();
          if (reauthed) {
            token = (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null) || googleAccessToken;
            if (token) {
              res = await syncGuidedLearningToGoogleDrive(currentLesson, token, user.email);
            }
          }
        }
        if (!res) throw firstErr;
      }

      if (res) {
        const updated: GuidedLearningLesson = {
          ...currentLesson,
          driveSyncStatus: 'synced',
          driveFileId: res.driveFileId,
          driveWebViewLink: res.driveWebViewLink,
          driveFolderPath: res.folderPath,
        };
        setCurrentLesson(updated);
        setGuidedHistory(getLocalGuidedLearningHistory());
        setLessonDriveNotice(`✓ Successfully synchronized to "${res.folderPath}" in Google Drive!`);
      }
    } catch (err: any) {
      setLessonDriveNotice(`Drive sync notice: ${err?.message || 'Could not sync file'}`);
    } finally {
      setIsSyncingLessonToDrive(false);
    }
  };

  const handleGenerateGuidedLesson = async (overridePrompt?: string) => {
    const topicToUse = overridePrompt || guidedTopic || selectedDomain?.samplePrompts[0]?.topic || '';
    if (!topicToUse.trim()) return;

    setIsGeneratingLesson(true);
    setLessonDriveNotice(null);

    try {
      const token = googleAccessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);
      const lesson = await generateGuidedLesson(
        {
          domainId: guidedDomainId,
          topic: topicToUse,
          targetAudience: guidedAudience,
          learningStyle: guidedStyle,
          lessonDepth: guidedDepth,
          language: guidedLanguage,
          provider: studioAiProvider,
          model: studioAiModel,
        },
        user.email,
        token || undefined
      );
      setCurrentLesson(lesson);
      setGuidedHistory(getLocalGuidedLearningHistory());
      if (lesson.driveSyncStatus === 'synced') {
        setLessonDriveNotice(`✓ Automatically synchronized to "${lesson.driveFolderPath}" in Google Drive!`);
      }
    } catch (err: any) {
      console.error('Failed to generate guided lesson:', err);
      setLessonDriveNotice(`Generation error: ${err?.message || 'Failed to generate masterclass'}`);
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  // ----------------------------------------------------
  // 1. Audio Transcription State
  // ----------------------------------------------------
  const [isRecordingTranscribe, setIsRecordingTranscribe] = useState(false);
  const [transcribeAudioBlob, setTranscribeAudioBlob] = useState<Blob | null>(null);
  const [transcribeAudioUrl, setTranscribeAudioUrl] = useState<string | null>(null);
  const [transcribePrompt, setTranscribePrompt] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<{
    text: string;
    modelUsed: string;
    timestamp: string;
  } | null>(null);
  const [transcribeCopied, setTranscribeCopied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ----------------------------------------------------
  // 2. Video from Text State (Google Veo & NVIDIA NIM)
  // ----------------------------------------------------
  const [videoAiProvider, setVideoAiProvider] = useState<'gemini' | 'nvidia'>(() => {
    return getActiveAiProvider() === 'nvidia' ? 'nvidia' : 'gemini';
  });
  const [videoNvidiaModel, setVideoNvidiaModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aura_nvidia_video_model') || localStorage.getItem('aura_nvidia_model');
      if (saved && (saved.includes('video') || saved.includes('cosmos') || saved.includes('svd'))) {
        return saved;
      }
    }
    return 'nvidia/cosmos-1.0-diffusion-7b';
  });
  const [veoPrompt, setVeoPrompt] = useState('');
  const [veoAspectRatio, setVeoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [veoResolution, setVeoResolution] = useState<'720p' | '1080p'>('720p');
  const [isGeneratingVeo, setIsGeneratingVeo] = useState(false);
  const [veoOperationName, setVeoOperationName] = useState<string | null>(null);
  const [veoProgressMsg, setVeoProgressMsg] = useState('');
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [veoError, setVeoError] = useState<string | null>(null);

  // ----------------------------------------------------
  // 4. Veo Animate Image State
  // ----------------------------------------------------
  const [animateImageFile, setAnimateImageFile] = useState<File | null>(null);
  const [animateImagePreview, setAnimateImagePreview] = useState<string | null>(null);
  const [animatePrompt, setAnimatePrompt] = useState('');
  const [isAnimatingImage, setIsAnimatingImage] = useState(false);
  const [animateOpName, setAnimateOpName] = useState<string | null>(null);
  const [animateProgressMsg, setAnimateProgressMsg] = useState('');
  const [animateVideoUrl, setAnimateVideoUrl] = useState<string | null>(null);
  const [animateError, setAnimateError] = useState<string | null>(null);

  // ----------------------------------------------------
  // Global Sovereign AI Engine & Multi-Turn Chatbot State
  // ----------------------------------------------------
  const [studioAiProvider, setStudioAiProvider] = useState<AiProvider>(() => getActiveAiProvider());
  const [studioAiModel, setStudioAiModel] = useState<string>(() => getActiveAiModel());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Sync with global model change events
  useEffect(() => {
    const handleModelChanged = (e: any) => {
      if (e.detail?.provider) {
        setStudioAiProvider(e.detail.provider);
        setStudioAiModel(e.detail.model);
        if (e.detail.provider === 'nvidia') {
          setImageAiProvider('nvidia');
          setMusicAiProvider('nvidia');
          setVideoAiProvider('nvidia');
          if (e.detail.model && (e.detail.model.includes('diffusion') || e.detail.model.includes('flux') || e.detail.model.includes('stability'))) {
            setImageNvidiaModel(e.detail.model);
          }
          if (e.detail.model && (e.detail.model.includes('nemotron') || e.detail.model.includes('llama'))) {
            setMusicNvidiaModel(e.detail.model);
          }
          if (e.detail.model && (e.detail.model.includes('video') || e.detail.model.includes('cosmos') || e.detail.model.includes('svd'))) {
            setVideoNvidiaModel(e.detail.model);
          }
        }
      }
    };
    window.addEventListener(AI_MODEL_CHANGED_EVENT, handleModelChanged);
    return () => window.removeEventListener(AI_MODEL_CHANGED_EVENT, handleModelChanged);
  }, []);

  const [chatAiProvider, setChatAiProvider] = useState<AiProvider>(() => getActiveAiProvider());
  const [chatNvidiaModel, setChatNvidiaModel] = useState<string>(() => getActiveAiModel());
  const [selectedRole, setSelectedRole] = useState('executive');
  const [taskComplexity, setTaskComplexity] = useState<'complex' | 'general' | 'fast'>('complex');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'model',
      text: `Greetings ${user?.name || 'Thamizh'}. I am your Sovereign AI engine, powered by Google Gemini and NVIDIA AI Foundation Models (NIM). How may I assist your life governance, venture roadmap, or family clarity today?`,
      modelUsed: 'gemini-4-argon',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // ----------------------------------------------------
  // 6. Lyria & NVIDIA NIM Music Generation State
  // ----------------------------------------------------
  const [musicAiProvider, setMusicAiProvider] = useState<'gemini' | 'nvidia'>(() => {
    return getActiveAiProvider() === 'nvidia' ? 'nvidia' : 'gemini';
  });
  const [musicNvidiaModel, setMusicNvidiaModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aura_nvidia_music_model') || localStorage.getItem('aura_nvidia_model');
      if (saved && (saved.includes('nemotron') || saved.includes('llama'))) {
        return saved;
      }
    }
    return 'nvidia/nemotron-3.5-lightning-30b-a3b';
  });
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicMode, setMusicMode] = useState<'clip' | 'pro'>('clip');
  const [musicImageFile, setMusicImageFile] = useState<File | null>(null);
  const [musicImagePreview, setMusicImagePreview] = useState<string | null>(null);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicResult, setMusicResult] = useState<{
    audioUrl: string;
    lyrics: string;
    modelUsed: string;
    mode: string;
  } | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  // ----------------------------------------------------
  // 7. Banana Image Studio & Editor State
  // ----------------------------------------------------
  const [imageAiProvider, setImageAiProvider] = useState<'gemini' | 'nvidia'>(() => {
    return getActiveAiProvider() === 'nvidia' ? 'nvidia' : 'gemini';
  });
  const [imageNvidiaModel, setImageNvidiaModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aura_nvidia_image_model') || localStorage.getItem('aura_nvidia_model');
      if (saved && (saved.includes('diffusion') || saved.includes('flux') || saved.includes('stability'))) {
        return saved;
      }
    }
    return 'black-forest-labs/flux.1-schnell';
  });
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  // Active AI Studio Creations & Drive Upload states
  const [activeImageCreation, setActiveImageCreation] = useState<AiStudioCreation | null>(null);
  const [activeMusicCreation, setActiveMusicCreation] = useState<AiStudioCreation | null>(null);
  const [activeVeoCreation, setActiveVeoCreation] = useState<AiStudioCreation | null>(null);
  const [activeAnimateCreation, setActiveAnimateCreation] = useState<AiStudioCreation | null>(null);
  const [activeTranscribeCreation, setActiveTranscribeCreation] = useState<AiStudioCreation | null>(null);
  const [uploadingDriveId, setUploadingDriveId] = useState<string | null>(null);
  const [driveUploadNotice, setDriveUploadNotice] = useState<string | null>(null);

  const handleUploadCreationToDrive = async (creation: AiStudioCreation, typeLabel: string) => {
    let token = googleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token') : null);
    if (!token) {
      setDriveUploadNotice('Connecting Google Account for Family Circle Drive upload...');
      const authed = await signInWithGoogleOAuth();
      if (authed) {
        token = (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token') : null) || googleAccessToken;
      }
    }
    if (!token) {
      setDriveUploadNotice('Google Drive sign-in required to save directly into Family Circle folder.');
      setTimeout(() => setDriveUploadNotice(null), 5000);
      return;
    }
    setUploadingDriveId(creation.id);
    setDriveUploadNotice(`Uploading ${typeLabel} to Family Circle / AI Studio Creations...`);
    try {
      const meta = await uploadAiCreationToGoogleDrive(creation, token, user?.email || 'chinna.tamil2000@gmail.com');
      if (meta) {
        const updated: AiStudioCreation = {
          ...creation,
          driveFileId: meta.driveFileId,
          driveWebViewLink: meta.driveWebViewLink,
          driveSyncStatus: 'synced',
        };
        if (creation.type === 'image') setActiveImageCreation(updated);
        else if (creation.type === 'music') setActiveMusicCreation(updated);
        else if (creation.type === 'video') {
          if (creation.tags?.includes('veo-animate')) setActiveAnimateCreation(updated);
          else setActiveVeoCreation(updated);
        } else if (creation.type === 'transcript') setActiveTranscribeCreation(updated);
        setDriveUploadNotice(`✓ ${typeLabel} saved to Google Drive under "${creation.driveFolderPath || 'Family Circle / AI Studio Creations'}"!`);
        setTimeout(() => setDriveUploadNotice(null), 5000);
      }
    } catch (err: any) {
      setDriveUploadNotice(`Upload error: ${err.message || 'Failed to upload to Google Drive'}`);
      setTimeout(() => setDriveUploadNotice(null), 5000);
    } finally {
      setUploadingDriveId(null);
    }
  };
  const [imageResult, setImageResult] = useState<{
    imageUrl: string;
    text: string;
    modelUsed: string;
  } | null>(null);

  // ----------------------------------------------------
  // 5. AURO Live Voice Turn State
  // ----------------------------------------------------
  const [liveVoiceInput, setLiveVoiceInput] = useState('');
  const [isLiveVoiceLoading, setIsLiveVoiceLoading] = useState(false);
  const [liveVoiceReply, setLiveVoiceReply] = useState<{
    text: string;
    audioUrl: string | null;
    modelUsed: string;
  } | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Clean up audio blob URLs on unmount
  useEffect(() => {
    return () => {
      if (transcribeAudioUrl) URL.revokeObjectURL(transcribeAudioUrl);
      if (veoVideoUrl) URL.revokeObjectURL(veoVideoUrl);
      if (animateVideoUrl) URL.revokeObjectURL(animateVideoUrl);
      if (musicResult?.audioUrl) URL.revokeObjectURL(musicResult.audioUrl);
      if (liveVoiceReply?.audioUrl) URL.revokeObjectURL(liveVoiceReply.audioUrl);
    };
  }, []);

  // ====================================================
  // Handlers: Transcription
  // ====================================================
  const handleStartTranscribeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setTranscribeAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setTranscribeAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecordingTranscribe(true);
    } catch (err: any) {
      alert(`Microphone access error: ${err.message}`);
    }
  };

  const handleStopTranscribeRecording = () => {
    if (mediaRecorderRef.current && isRecordingTranscribe) {
      mediaRecorderRef.current.stop();
      setIsRecordingTranscribe(false);
    }
  };

  const handleTranscribeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTranscribeAudioBlob(file);
      const url = URL.createObjectURL(file);
      setTranscribeAudioUrl(url);
    }
  };

  const handleRunTranscription = async () => {
    if (!transcribeAudioBlob) return;
    setIsTranscribing(true);
    try {
      const res = await transcribeAudio(transcribeAudioBlob, transcribePrompt || undefined, studioAiProvider, studioAiModel);
      setTranscribeResult(res);
      const item = await registerAiCreation({
        title: transcribePrompt ? `Transcript: ${transcribePrompt.slice(0, 36)}` : 'Voice Audio Transcription',
        type: 'transcript',
        modelUsed: res.modelUsed || 'gemini-2.5-flash',
        model: res.modelUsed || 'gemini-2.5-flash',
        prompt: transcribePrompt || 'Audio speech-to-text',
        mediaUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(res.text)}`,
        contentPreview: res.text,
        mimeType: 'text/plain',
        drivePath: 'Family Circle / AI Studio Creations / Transcripts',
        tags: ['transcription', 'audio', 'speech-to-text'],
      });
      setActiveTranscribeCreation(item);
    } catch (err: any) {
      alert(`Transcription error: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ====================================================
  // Handlers: Veo 3 Video from Text
  // ====================================================
  const handleGenerateVeoVideo = async () => {
    if (!veoPrompt.trim()) return;
    setIsGeneratingVeo(true);
    setVeoError(null);
    setVeoVideoUrl(null);
    setVeoProgressMsg(
      videoAiProvider === 'nvidia'
        ? `Initializing NVIDIA NIM Video Engine (${videoNvidiaModel})...`
        : 'Initializing Google Veo 3 generation pipeline...'
    );

    try {
      const init = await generateVideoFromText(veoPrompt, veoAspectRatio, veoResolution, {
        provider: videoAiProvider,
        model: videoAiProvider === 'nvidia' ? videoNvidiaModel : undefined,
      });
      setVeoOperationName(init.operationName);
      setVeoProgressMsg(
        videoAiProvider === 'nvidia'
          ? 'Rendering photorealistic keyframes and camera dynamics via NVIDIA GPU...'
          : 'Synthesizing high-fidelity cinematic frames. Polling progress...'
      );

      // Polling loop
      let done = false;
      let attempts = 0;
      while (!done && attempts < 40) {
        attempts++;
        await new Promise((r) => setTimeout(r, 4000));
        setVeoProgressMsg(
          videoAiProvider === 'nvidia'
            ? `Synthesizing NVIDIA video stream (${Math.min(attempts * 10, 95)}% est)...`
            : `Rendering frames (${attempts * 5}% est). Veo 3 physics & light transport solving...`
        );
        const status = await pollVideoOperation(init.operationName);
        if (status.done) {
          done = true;
          if (status.error) {
            throw new Error(status.error.message || 'Video generation returned an error');
          }
          setVeoProgressMsg('Assembling final MP4 stream...');
          const videoBlobUrl = await fetchCompletedVideoBlob(init.operationName);
          setVeoVideoUrl(videoBlobUrl);
          setVeoProgressMsg('Cinematic video generated successfully!');
          const titlePrefix = videoAiProvider === 'nvidia' ? 'NVIDIA Video' : 'Veo 3';
          const modelUsed = init.modelUsed || (videoAiProvider === 'nvidia' ? videoNvidiaModel : 'veo-3.1-lite');
          const item = await registerAiCreation({
            title: `${titlePrefix}: ${veoPrompt.slice(0, 36)}`,
            type: 'video',
            modelUsed,
            model: modelUsed,
            prompt: veoPrompt,
            mediaUrl: videoBlobUrl,
            mimeType: 'video/mp4',
            drivePath: 'Family Circle / AI Studio Creations / Videos',
            aspectRatio: veoAspectRatio,
            tags: [videoAiProvider === 'nvidia' ? 'nvidia-video' : 'veo-3', 'cinematic', 'video-generation', veoAspectRatio],
          });
          setActiveVeoCreation(item);
          break;
        }
      }
      if (!done) {
        throw new Error('Video generation timed out. Please check back shortly.');
      }
    } catch (err: any) {
      console.error('Video generation error:', err);
      setVeoError(err.message || 'Failed to generate video');
    } finally {
      setIsGeneratingVeo(false);
    }
  };

  // ====================================================
  // Handlers: Veo Animate Image
  // ====================================================
  const handleAnimateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnimateImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAnimateImagePreview(reader.result);
        }
      };
      reader.onerror = () => setAnimateImagePreview(null);
      reader.readAsDataURL(file);
    }
  };

  const handleAnimateImageToVideo = async () => {
    if (!animateImageFile && !animateImagePreview) return;
    setIsAnimatingImage(true);
    setAnimateError(null);
    setAnimateVideoUrl(null);
    setAnimateProgressMsg(
      videoAiProvider === 'nvidia'
        ? `Analyzing photo depth & motion trajectory with NVIDIA NIM (${videoNvidiaModel})...`
        : 'Analyzing image composition, lighting depth, and motion vectors...'
    );

    try {
      const source = animateImageFile || (animateImagePreview as string);
      const init = await animateImageToVideo(source, animatePrompt || undefined, '16:9', '720p', {
        provider: videoAiProvider,
        model: videoAiProvider === 'nvidia' ? videoNvidiaModel : undefined,
      });
      setAnimateOpName(init.operationName);
      setAnimateProgressMsg(
        videoAiProvider === 'nvidia'
          ? 'Generating camera motion vectors and temporal interpolation with NVIDIA...'
          : 'Generating natural physical motion with Veo 3. Polling progress...'
      );

      let done = false;
      let attempts = 0;
      while (!done && attempts < 40) {
        attempts++;
        await new Promise((r) => setTimeout(r, 4000));
        setAnimateProgressMsg(
          videoAiProvider === 'nvidia'
            ? `Synthesizing motion dynamics (${Math.min(attempts * 10, 95)}% est)...`
            : `Interpolating temporal coherence (${attempts * 5}% est)...`
        );
        const status = await pollVideoOperation(init.operationName);
        if (status.done) {
          done = true;
          if (status.error) {
            throw new Error(status.error.message || 'Image animation failed');
          }
          setAnimateProgressMsg('Compiling video stream...');
          const videoBlobUrl = await fetchCompletedVideoBlob(init.operationName);
          setAnimateVideoUrl(videoBlobUrl);
          setAnimateProgressMsg('Photo brought to life successfully!');
          const titlePrefix = videoAiProvider === 'nvidia' ? 'NVIDIA Motion' : 'Veo Animate';
          const modelUsed = init.modelUsed || (videoAiProvider === 'nvidia' ? videoNvidiaModel : 'veo-3.1-lite');
          const item = await registerAiCreation({
            title: animatePrompt ? `${titlePrefix}: ${animatePrompt.slice(0, 32)}` : `${titlePrefix} Photo Motion`,
            type: 'video',
            modelUsed,
            model: modelUsed,
            prompt: animatePrompt || 'Motion photo animation',
            mediaUrl: videoBlobUrl,
            mimeType: 'video/mp4',
            drivePath: 'Family Circle / AI Studio Creations / Videos',
            tags: [videoAiProvider === 'nvidia' ? 'nvidia-motion' : 'veo-animate', 'photo-motion', 'video'],
          });
          setActiveAnimateCreation(item);
          break;
        }
      }
      if (!done) {
        throw new Error('Video animation timed out. Please check back shortly.');
      }
    } catch (err: any) {
      console.error('Animate image error:', err);
      setAnimateError(err.message || 'Failed to animate image');
    } finally {
      setIsAnimatingImage(false);
    }
  };

  // ====================================================
  // Handlers: Multi-Turn Chat
  // ====================================================
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newThread = [...chatMessages, userMsg];
    setChatMessages(newThread);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const messagesForApi = newThread.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await sendMultiTurnChat(messagesForApi, {
        role: selectedRole,
        taskComplexity,
        provider: studioAiProvider,
        model: studioAiModel,
      });

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: res.reply,
        modelUsed: res.modelUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages([...newThread, modelMsg]);
    } catch (err: any) {
      let friendlyError = err.message || 'Network error';
      try {
        if (typeof friendlyError === 'string' && friendlyError.includes('{')) {
          const jsonStart = friendlyError.indexOf('{');
          const parsed = JSON.parse(friendlyError.slice(jsonStart));
          if (parsed.error?.message) {
            friendlyError = parsed.error.message;
          }
        }
      } catch {}

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `Error processing request: ${friendlyError}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages([...newThread, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ====================================================
  // Handlers: Lyria Music Generation
  // ====================================================
  const handleMusicImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMusicImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setMusicImagePreview(reader.result);
        }
      };
      reader.onerror = () => setMusicImagePreview(null);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setIsGeneratingMusic(true);
    setMusicResult(null);

    try {
      const imgSource = musicImageFile || (musicImagePreview as string) || undefined;
      const res = await generateMusic(musicPrompt, musicMode, imgSource, {
        provider: musicAiProvider,
        model: musicAiProvider === 'nvidia' ? musicNvidiaModel : undefined,
      });
      setMusicResult(res);
      if (res?.audioUrl) {
        const titlePrefix = musicAiProvider === 'nvidia' ? 'NVIDIA NIM' : 'Lyria';
        const modelIdentifier = res.modelUsed || (musicAiProvider === 'nvidia' ? musicNvidiaModel : 'google/lyria-music-2.5');
        const item = await registerAiCreation({
          title: `${titlePrefix}: ${musicPrompt.slice(0, 32)}`,
          type: 'music',
          modelUsed: modelIdentifier,
          model: modelIdentifier,
          prompt: musicPrompt,
          mediaUrl: res.audioUrl,
          mimeType: 'audio/mp3',
          drivePath: 'Family Circle / AI Studio Creations / Music',
          tags: [musicAiProvider === 'nvidia' ? 'nvidia' : 'lyria', 'song', 'music-generation', musicMode],
        });
        setActiveMusicCreation(item);
      }
    } catch (err: any) {
      let friendlyError = err.message || 'Failed to generate music';
      try {
        if (typeof friendlyError === 'string' && friendlyError.includes('{')) {
          const jsonStart = friendlyError.indexOf('{');
          const parsed = JSON.parse(friendlyError.slice(jsonStart));
          if (parsed.error?.message) {
            friendlyError = parsed.error.message;
          }
        }
      } catch {}
      alert(`Music generation: ${friendlyError}`);
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const togglePlayMusic = () => {
    if (!musicAudioRef.current) return;
    if (isMusicPlaying) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      musicAudioRef.current.play();
      setIsMusicPlaying(true);
    }
  };

  // ====================================================
  // Handlers: Banana Image Studio
  // ====================================================
  const handleSourceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSourceImagePreview(reader.result);
        }
      };
      reader.onerror = () => setSourceImagePreview(null);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateOrEditImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setImageResult(null);

    try {
      const source = sourceImageFile || (sourceImagePreview as string) || undefined;
      const chosenModel = imageAiProvider === 'nvidia' ? imageNvidiaModel : 'gemini-nano-banana-2.1';
      const res = await generateOrEditImage(imagePrompt, {
        imageSource: source,
        aspectRatio: imageAspectRatio,
        imageSize: imageSize,
        useSearch: useSearchGrounding,
        provider: imageAiProvider,
        model: chosenModel,
      });
      setImageResult(res);
      if (res?.imageUrl) {
        const item = await registerAiCreation({
          title: `${imageAiProvider === 'nvidia' ? 'NVIDIA' : 'Imagen'}: ${imagePrompt.slice(0, 32)}`,
          type: 'image',
          modelUsed: res.modelUsed || chosenModel,
          model: res.modelUsed || chosenModel,
          prompt: imagePrompt,
          mediaUrl: res.imageUrl,
          mimeType: 'image/png',
          drivePath: 'Family Circle / AI Studio Creations / Images',
          aspectRatio: imageAspectRatio,
          tags: ['imagen', 'visual-art', imageAiProvider, chosenModel, imageAspectRatio],
        });
        setActiveImageCreation(item);
      }
    } catch (err: any) {
      alert(`Image Studio error: ${err.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ====================================================
  // Handlers: AURO Live Voice Turn
  // ====================================================
  const handleSendLiveVoiceTurn = async (customPrompt?: string) => {
    const p = customPrompt || liveVoiceInput.trim();
    if (!p) return;
    speechEngine.unlockAudio();
    setIsLiveVoiceLoading(true);
    try {
      const res = await converseLiveTurn(undefined, p);
      setLiveVoiceReply(res);
      if (res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.play().catch(() => {
          if (res.text) {
            speechEngine.speak(res.text, { emotion: 'encouraging' });
          }
        });
      } else if (res.text) {
        speechEngine.speak(res.text, { emotion: 'encouraging' });
      }
    } catch (err: any) {
      alert(`Live voice turn error: ${err.message}`);
    } finally {
      setIsLiveVoiceLoading(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-3 sm:px-4 max-w-4xl mx-auto space-y-5">
      {/* Top AI Studio Header & Brand Badge */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950/60 to-purple-950/40 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" />
                Gemini Multi-Modal AI Studio
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live & Connected
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Next-Gen Gemini AI Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-1">
              Full enterprise integration of Google's frontier models: Veo 3 Video, Lyria Music, Banana Image Studio, Gemini 4 Argon Reasoning, Transcribe 3.5 & AURO Live Voice.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Active AI Model Configuration Button */}
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3 py-1.5 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-indigo-500/50 text-slate-200 text-xs font-semibold flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              title="Click to switch or configure active AI model"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <div className="text-left">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                  Engine ({studioAiProvider.toUpperCase()})
                </span>
                <span className="font-bold text-white text-[11px] truncate max-w-[130px] block font-mono">
                  {getModelDisplayName(studioAiProvider, studioAiModel)}
                </span>
              </div>
              <span className="text-[10px] text-indigo-400 ml-1">▾</span>
            </button>

            {onOpenVoiceAssistant && (
              <button
                onClick={onOpenVoiceAssistant}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                <Radio className="w-4 h-4 animate-pulse text-pink-300" />
                <span>Launch AURO Assistant</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature Sub-Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-indigo-500/20 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'overview', label: 'Suite Hub', icon: Sparkles },
            { id: 'guided-learning', label: 'Guided Learning', icon: GraduationCap, badge: 'Gemini' },
            { id: 'veo-video', label: 'Veo 3 Video', icon: Video, badge: 'New' },
            { id: 'veo-animate', label: 'Animate Photo', icon: Wand2 },
            { id: 'chat', label: 'Argon Chat', icon: Brain },
            { id: 'music', label: 'Lyria Music', icon: Music },
            { id: 'images', label: 'Banana Studio', icon: ImageIcon },
            { id: 'transcribe', label: 'Transcribe 3.5', icon: Mic },
            { id: 'live-voice', label: 'Live Voice', icon: Radio },
            { id: 'history', label: 'Drive & History', icon: HardDrive, badge: 'Drive' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AiStudioSubTab)}
                className={`px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950 uppercase">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 0. OVERVIEW HUB */}
      {/* ==================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {/* Card: Gemini Guided Learning */}
            <div
              onClick={() => setActiveTab('guided-learning')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                  gemini-guided
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors">
                Gemini Guided Learning
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Interactive Socratic masterclasses, STEM & Python curriculum constructors, and 1-click Drive sync under Family Circle.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-teal-400">
                <span>Start Guided Session</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 1: Veo 3 Video */}
            <div
              onClick={() => setActiveTab('veo-video')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  veo-3.1-lite
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                Veo 3 Video Generator
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Create 720p & 1080p cinematic video sequences with landscape (16:9) or vertical reel (9:16) rendering.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                <span>Launch Video Studio</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: Animate Photo */}
            <div
              onClick={() => setActiveTab('veo-animate')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                  <Wand2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  Motion Veo
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                Animate Photos to Video
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Bring family memories, portraits, or blueprints to life with natural physics and smooth camera sweeps.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-purple-400">
                <span>Animate Photos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3: Lyria Music */}
            <div
              onClick={() => setActiveTab('music')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
                  <Music className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300">
                  lyria-3-pro
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-pink-400 transition-colors">
                Lyria Music Studio
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Generate high-definition music tracks, Tamil ambient lofi, or family focus melodies from text & photo inspiration.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-pink-400">
                <span>Generate Music</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 4: Gemini 4 Argon Chat */}
            <div
              onClick={() => setActiveTab('chat')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Brain className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  gemini-4-argon
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Argon Deep Reasoner
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Dynamic model routing across Gemini 4 Argon (complex logic), Flash 3.8, and Flash Lite 3.1 with 5 expert roles.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                <span>Open Multi-Turn Chat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 5: Banana Image Studio */}
            <div
              onClick={() => setActiveTab('images')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  banana-2.1
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                Banana Image Studio
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                High-fidelity 1K/2K/4K image generation & natural conversational photo editing with Google Search visual grounding.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span>Create & Edit Images</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 6: Transcribe 3.5 */}
            <div
              onClick={() => setActiveTab('transcribe')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                  <Mic className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  transcribe-3.5
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                Audio Transcription Lab
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Record live mic speech or upload audio recordings for instantaneous, high-accuracy multi-lingual transcription.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                <span>Start Transcribing</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 7: Drive Path & History */}
            <div
              onClick={() => setActiveTab('history')}
              className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <HardDrive className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                  Drive Sync
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                Family Drive & History Dashboard
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                All generated images, Veo videos, Lyria songs, and audio transcripts auto-archived into Google Drive under Family Circle and cached offline.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                <span>View Creations History</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Quick AI Presets for Family & Venture */}
          <div className="rounded-3xl p-5 bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Recommended Quick Actions for Thamizh & Family
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => {
                  setVeoPrompt('Cinematic drone shot of Chennai coastline with futuristic sustainable vertical gardens, sunset golden light reflecting on calm waters, 4K documentary style.');
                  setActiveTab('veo-video');
                }}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-indigo-950/40 border border-slate-800/80 hover:border-indigo-500/40 text-left transition-all"
              >
                <div className="font-semibold text-slate-200">🎬 Generate Chennai Coastline Drone Video</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Veo 3 1080p landscape rendering</div>
              </button>

              <button
                onClick={() => {
                  setMusicPrompt('Warm Tamil classical acoustic flute and veena blended with deep ambient electronic study beats, peaceful and focused.');
                  setActiveTab('music');
                }}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-pink-950/40 border border-slate-800/80 hover:border-pink-500/40 text-left transition-all"
              >
                <div className="font-semibold text-slate-200">🎵 Compose Focus Melody (Veena & Lo-Fi)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Lyria 3 Pro composition</div>
              </button>

              <button
                onClick={() => {
                  setSelectedRole('stem_tutor');
                  setTaskComplexity('complex');
                  setChatInput('Explain how autonomous robotics pathfinding algorithms (A* vs RRT*) work to Maaran with an engaging space rover scenario.');
                  setActiveTab('chat');
                }}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-amber-950/40 border border-slate-800/80 hover:border-amber-500/40 text-left transition-all"
              >
                <div className="font-semibold text-slate-200">🤖 Maaran STEM Robotics Session</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Gemini 4 Argon deep STEM reasoning</div>
              </button>

              <button
                onClick={() => {
                  setImagePrompt('High-end executive sovereign life operating dashboard with holographic family milestones, sapphire accents, cinematic lighting, photorealistic 8K.');
                  setActiveTab('images');
                }}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-emerald-950/40 border border-slate-800/80 hover:border-emerald-500/40 text-left transition-all"
              >
                <div className="font-semibold text-slate-200">🎨 Render Sovereign Life OS Concept Art</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Gemini Banana 2.1 2K generation</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
            {/* ==================================================== */}
      {/* GEMINI GUIDED LEARNING & SAMPLE PROMPT CONSTRUCTOR */}
      {/* ==================================================== */}
      {activeTab === 'guided-learning' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Gemini Guided Learning Studio</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold uppercase">
                    Family Circle Drive Synced
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Interactive Socratic masterclasses, pedagogical prompt constructors, and structured study guides.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Folder:</span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-teal-300">
                Family Circle / Guided Learning
              </span>
            </div>
          </div>

          {/* 1. Domain / Subject Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Learning Subject or Domain
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GUIDED_LEARNING_DOMAINS.map((domain) => {
                const isSelected = guidedDomainId === domain.id;
                return (
                  <button
                    key={domain.id}
                    onClick={() => {
                      setGuidedDomainId(domain.id);
                      setGuidedTopic(domain.samplePrompts[0]?.topic || '');
                    }}
                    className={`p-3 rounded-2xl text-left transition-all border ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500/50 text-white shadow-md shadow-teal-500/10'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <p className={`text-xs font-bold ${isSelected ? 'text-teal-300' : 'text-slate-200'}`}>
                      {domain.name}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{domain.category}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Interactive Sample Prompt Constructor & Pedagogical Tuning */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Pedagogical Prompt Constructor</span>
              </span>
              <span className="text-[10px] text-slate-500">Auto-tunes Gemini system instructions</span>
            </div>

            {/* Constructor Selectors: Audience, Style, Scope, Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {/* Target Audience */}
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Target Learner</label>
                <select
                  value={guidedAudience}
                  onChange={(e) => setGuidedAudience(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="kids">Kids (Age 8-14)</option>
                  <option value="teens">Teens & High School</option>
                  <option value="intermediate">Intermediate / Adult</option>
                  <option value="expert">Advanced Master</option>
                </select>
              </div>

              {/* Learning Style */}
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Pedagogical Style</label>
                <select
                  value={guidedStyle}
                  onChange={(e) => setGuidedStyle(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="hands_on_project">Hands-On Lab & Project</option>
                  <option value="analogies">Visual Analogies & Models</option>
                  <option value="socratic">Socratic Questioning</option>
                  <option value="executive_summary">Executive Cheat Sheet</option>
                </select>
              </div>

              {/* Lesson Scope */}
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Lesson Scope</label>
                <select
                  value={guidedDepth}
                  onChange={(e) => setGuidedDepth(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="5_min_concept">5-Min Concept Sprint</option>
                  <option value="deep_dive_masterclass">Deep-Dive 3-Step Lesson</option>
                  <option value="complete_curriculum">Full Curriculum Syllabus</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Language</label>
                <select
                  value={guidedLanguage}
                  onChange={(e) => setGuidedLanguage(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="en">English</option>
                  <option value="ta">Pure Tamil (தமிழ்)</option>
                  <option value="tanglish">Bilingual (Tanglish)</option>
                </select>
              </div>
            </div>

            {/* Quick Sample Prompts Chips */}
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1.5">
                Constructed Sample Prompts for {selectedDomain?.name}:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedDomain?.samplePrompts.map((sp, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setGuidedTopic(sp.topic);
                      setGuidedAudience(sp.recommendedLevel);
                      setGuidedStyle(sp.recommendedStyle);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      guidedTopic === sp.topic
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>💡 {sp.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Topic / Prompt Input */}
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                Lesson Topic or Custom Prompt:
              </label>
              <textarea
                value={guidedTopic}
                onChange={(e) => setGuidedTopic(e.target.value)}
                placeholder="Enter what you or your family want to learn..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const constructed = constructGuidedPrompt({
                    domainId: guidedDomainId,
                    topic: guidedTopic || selectedDomain?.samplePrompts[0]?.topic || '',
                    targetAudience: guidedAudience,
                    learningStyle: guidedStyle,
                    lessonDepth: guidedDepth,
                    language: guidedLanguage,
                  });
                  setConstructedPromptPreview(constructedPromptPreview ? '' : constructed);
                }}
                className="text-xs text-slate-400 hover:text-teal-400 underline"
              >
                {constructedPromptPreview ? 'Hide Constructed Master Prompt' : 'Preview Constructed Master Prompt'}
              </button>

              <button
                onClick={() => handleGenerateGuidedLesson()}
                disabled={isGeneratingLesson || (!guidedTopic.trim() && !selectedDomain?.samplePrompts[0]?.topic)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isGeneratingLesson ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini is Architecting Lesson...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Guided Masterclass</span>
                  </>
                )}
              </button>
            </div>

            {/* Constructed Prompt Preview Accordion */}
            {constructedPromptPreview && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                {constructedPromptPreview}
              </div>
            )}
          </div>

          {/* Drive Sync Notice Banner */}
          {lessonDriveNotice && (
            <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{lessonDriveNotice}</span>
              </div>
              {currentLesson?.driveWebViewLink && (
                <a
                  href={currentLesson.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                >
                  <span>Open in Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* 3. Generated Lesson Display */}
          {currentLesson && (
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4">
              {/* Lesson Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase">
                      {currentLesson.domainName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(currentLesson.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{currentLesson.title}</h3>
                </div>

                {/* Lesson Actions: Sync to Drive, Listen, Copy */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncLessonToDrive}
                    disabled={isSyncingLessonToDrive}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      currentLesson.driveSyncStatus === 'synced'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>
                      {currentLesson.driveSyncStatus === 'synced'
                        ? '✓ Synced in Drive'
                        : isSyncingLessonToDrive
                        ? 'Syncing to Drive...'
                        : 'Sync to Google Drive'}
                    </span>
                  </button>

                  <button
                    onClick={handleReadLessonAloud}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white"
                    title={isPlayingLessonAudio ? 'Stop speech' : 'Listen with TTS voice'}
                  >
                    <Volume2 className={`w-4 h-4 ${isPlayingLessonAudio ? 'text-teal-400 animate-pulse' : ''}`} />
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentLesson.content);
                      setLessonDriveNotice('✓ Lesson copied to clipboard!');
                      setTimeout(() => setLessonDriveNotice(null), 2500);
                    }}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white"
                    title="Copy lesson markdown"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary Callout */}
              {currentLesson.summary && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border-l-4 border-teal-500 text-xs text-slate-200 leading-relaxed">
                  <span className="font-bold text-teal-300">Objective: </span>
                  {currentLesson.summary}
                </div>
              )}

              {/* Key Takeaways */}
              {currentLesson.keyTakeaways.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentLesson.keyTakeaways.map((point, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-200 text-[11px] flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Full Content (Markdown body) */}
              <div className="prose prose-invert prose-xs max-w-none text-slate-200 text-xs leading-relaxed space-y-3 font-normal whitespace-pre-wrap bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
                {currentLesson.content}
              </div>
            </div>
          )}

          {/* 4. Past Guided Learning History in Family Circle */}
          {guidedHistory.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Recent Guided Learning Sessions in Family Circle ({guidedHistory.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {guidedHistory.slice(0, 6).map((past) => (
                  <div
                    key={past.id}
                    onClick={() => {
                      setCurrentLesson(past);
                      setGuidedDomainId(past.domainId);
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      currentLesson?.id === past.id
                        ? 'bg-teal-500/15 border-teal-500/50 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-semibold text-teal-400">{past.domainName}</span>
                      <span>{new Date(past.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{past.title}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[120px]">{past.prompt}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          past.driveSyncStatus === 'synced'
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {past.driveSyncStatus === 'synced' ? 'DRIVE' : 'LOCAL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. AUDIO TRANSCRIPTION LAB (gemini-3.5-transcribe) */}
      {/* ==================================================== */}
      {activeTab === 'transcribe' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Audio Transcription Lab</h2>
                <p className="text-xs text-slate-400">Model: gemini-3.5-transcribe</p>
              </div>
            </div>
          </div>

          {/* Recording & Upload Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <button
                onClick={isRecordingTranscribe ? handleStopTranscribeRecording : handleStartTranscribeRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecordingTranscribe
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {isRecordingTranscribe ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
              <div>
                <div className="text-xs font-bold text-white">
                  {isRecordingTranscribe ? 'Recording Audio Live...' : 'Tap to Record Microphone'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isRecordingTranscribe ? 'Tap to finish recording' : 'Crystal clear voice capture'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
              <label className="cursor-pointer flex flex-col items-center">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-200 mt-2">Upload Audio File</span>
                <span className="text-[10px] text-slate-500">MP3, WAV, M4A, WEBM, OGG</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleTranscribeFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Audio Player Preview if available */}
          {transcribeAudioUrl && (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
              <audio src={transcribeAudioUrl} controls className="w-full h-9 rounded-lg" />
            </div>
          )}

          {/* Optional Prompt Steering */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optional Transcription Steering Prompt:
            </label>
            <input
              type="text"
              value={transcribePrompt}
              onChange={(e) => setTranscribePrompt(e.target.value)}
              placeholder="e.g. Transcribe with speaker labels, format key action items, translate Tamil terms..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleRunTranscription}
            disabled={!transcribeAudioBlob || isTranscribing}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            {isTranscribing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Transcribing with gemini-3.5-transcribe...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Execute Audio Transcription</span>
              </>
            )}
          </button>

          {/* Transcription Result Output */}
          {transcribeResult && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400">
                  Model: <strong className="text-blue-400">{transcribeResult.modelUsed}</strong>
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(transcribeResult.text);
                    setTranscribeCopied(true);
                    setTimeout(() => setTranscribeCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-[11px] flex items-center gap-1 border border-slate-800"
                >
                  {transcribeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{transcribeCopied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {transcribeResult.text}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. VIDEO GENERATOR (Google Veo & NVIDIA NIM) */}
      {/* ==================================================== */}
      {activeTab === 'veo-video' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AI Video Generator</h2>
                <p className="text-xs text-slate-400">
                  {videoAiProvider === 'nvidia'
                    ? `NVIDIA NIM: ${videoNvidiaModel}`
                    : 'Google Veo 3.1 (veo-3.1-lite-generate-preview)'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
              Cinematic Engine
            </span>
          </div>

          {/* AI Engine Selector: Google Veo vs NVIDIA NIM */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Video Foundation Engine:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVideoAiProvider('gemini')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  videoAiProvider === 'gemini'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Google Veo 3.1</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoAiProvider('nvidia')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  videoAiProvider === 'nvidia'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-300" />
                <span>NVIDIA NIM</span>
              </button>
            </div>
          </div>

          {/* NVIDIA NIM Video Model Selector */}
          {videoAiProvider === 'nvidia' && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chosen NVIDIA Video Model:</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono">
                  ACTIVE
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'nvidia/cosmos-1.0-diffusion-7b',
                    name: 'NVIDIA Cosmos 1.0 Diffusion',
                    tag: 'World-foundation physical dynamics & photorealistic video generation',
                  },
                  {
                    id: 'nvidia/nemotron-video-director-30b',
                    name: 'NVIDIA Nemotron Video Director 30B',
                    tag: 'High-throughput cinematic camera sweeps, pans & lighting transport',
                  },
                  {
                    id: 'stabilityai/stable-video-diffusion-img2vid-xt',
                    name: 'Stable Video Diffusion XT',
                    tag: 'Temporal motion synthesis & cinematic frame interpolation on NVIDIA NIM',
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setVideoNvidiaModel(m.id);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('aura_nvidia_video_model', m.id);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                      videoNvidiaModel === m.id
                        ? 'bg-emerald-900/40 border-emerald-500/60 text-white ring-1 ring-emerald-400/50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{m.name}</span>
                      {videoNvidiaModel === m.id && (
                        <span className="text-[10px] font-bold text-emerald-400">âœ“ Selected</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.tag}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Video Scene Prompt:
            </label>
            <textarea
              rows={3}
              value={veoPrompt}
              onChange={(e) => setVeoPrompt(e.target.value)}
              placeholder="Describe the cinematic scene in vivid detail (e.g. Drone camera sweeping across the Chennai coastline at golden hour, waves gently breaking, high dynamic range 1080p)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Quick Prompt Starters */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              'Futuristic Chennai tech campus drone tour',
              'Maaran building a robotics quadcopter in high-tech lab',
              'Thamizh and Selvapriya in peaceful hill station tea estate',
              'Autonomous electric hypercar speeding down cyber highway',
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setVeoPrompt(p)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>

          {/* Video Parameters */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVeoAspectRatio('16:9')}
                  className={`py-2 rounded-xl font-semibold border ${
                    veoAspectRatio === '16:9'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  16:9 Landscape
                </button>
                <button
                  type="button"
                  onClick={() => setVeoAspectRatio('9:16')}
                  className={`py-2 rounded-xl font-semibold border ${
                    veoAspectRatio === '9:16'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  9:16 Reel/Short
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Resolution</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVeoResolution('720p')}
                  className={`py-2 rounded-xl font-semibold border ${
                    veoResolution === '720p'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  720p HD
                </button>
                <button
                  type="button"
                  onClick={() => setVeoResolution('1080p')}
                  className={`py-2 rounded-xl font-semibold border ${
                    veoResolution === '1080p'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  1080p Full HD
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerateVeoVideo}
            disabled={!veoPrompt.trim() || isGeneratingVeo}
            className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-white ${
              videoAiProvider === 'nvidia'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {isGeneratingVeo ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {videoAiProvider === 'nvidia'
                    ? `Generating Cinematic Video via NVIDIA (${videoNvidiaModel.split('/')[1] || videoNvidiaModel})...`
                    : 'Generating Cinematic Video with Veo 3...'}
                </span>
              </>
            ) : (
              <>
                {videoAiProvider === 'nvidia' ? <Cpu className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span>
                  {videoAiProvider === 'nvidia'
                    ? `Generate Video via NVIDIA (${videoNvidiaModel.split('/')[1] || videoNvidiaModel})`
                    : 'Generate Video with Veo 3'}
                </span>
              </>
            )}
          </button>

          {/* Progress / Status tracker */}
          {isGeneratingVeo && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-2 text-center">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <div className="text-xs font-bold text-white">{veoProgressMsg}</div>
              <div className="text-[10px] text-slate-400">
                Veo generates photorealistic motion with neural light fields. This process takes 30-90 seconds.
              </div>
            </div>
          )}

          {/* Video Player Output */}
          {veoVideoUrl && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Generated Veo 3 Video ({veoAspectRatio})</span>
                <a
                  href={veoVideoUrl}
                  download="veo-cinematic.mp4"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
              </div>
              <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video src={veoVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          {veoError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{veoError}</span>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. ANIMATE IMAGE TO VIDEO (Google Veo & NVIDIA NIM) */}
      {/* ==================================================== */}
      {activeTab === 'veo-animate' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Animate Photo to Video</h2>
                <p className="text-xs text-slate-400">
                  {videoAiProvider === 'nvidia'
                    ? `NVIDIA NIM: ${videoNvidiaModel}`
                    : 'Google Veo 3.1 (veo-3.1-lite-generate-preview)'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
              Photo Dynamics
            </span>
          </div>

          {/* AI Engine Selector: Google Veo vs NVIDIA NIM */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Motion Foundation Engine:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVideoAiProvider('gemini')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  videoAiProvider === 'gemini'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Google Veo 3.1</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoAiProvider('nvidia')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  videoAiProvider === 'nvidia'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-300" />
                <span>NVIDIA NIM</span>
              </button>
            </div>
          </div>

          {/* NVIDIA NIM Motion Model Selector */}
          {videoAiProvider === 'nvidia' && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chosen NVIDIA Motion Model:</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono">
                  ACTIVE
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'stabilityai/stable-video-diffusion-img2vid-xt',
                    name: 'Stable Video Diffusion XT',
                    tag: 'Cinematic image-to-video motion dynamics & smooth camera pan/zoom',
                  },
                  {
                    id: 'nvidia/cosmos-1.0-diffusion-7b',
                    name: 'NVIDIA Cosmos 1.0 Diffusion',
                    tag: 'Generative physical world simulation & realistic environmental animation',
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setVideoNvidiaModel(m.id);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('aura_nvidia_video_model', m.id);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                      videoNvidiaModel === m.id
                        ? 'bg-emerald-900/40 border-emerald-500/60 text-white ring-1 ring-emerald-400/50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{m.name}</span>
                      {videoNvidiaModel === m.id && (
                        <span className="text-[10px] font-bold text-emerald-400">âœ“ Selected</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.tag}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload Image Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
              <label className="cursor-pointer flex flex-col items-center w-full">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-purple-400 hover:text-white transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-200 mt-2">Select Image to Animate</span>
                <span className="text-[10px] text-slate-500">Family photo, concept art, portrait</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAnimateImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {animateImagePreview && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                <img
                  src={animateImagePreview}
                  alt="Preview"
                  className="max-h-36 rounded-xl object-contain"
                />
                <span className="text-[10px] text-slate-400 mt-1">Starting Frame</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Motion Guidance Prompt (Optional):
            </label>
            <input
              type="text"
              value={animatePrompt}
              onChange={(e) => setAnimatePrompt(e.target.value)}
              placeholder="e.g. Gentle breeze blowing through trees, subtle camera push-in, golden sunset light glowing..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleAnimateImageToVideo}
            disabled={!animateImagePreview || isAnimatingImage}
            className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-white ${
              videoAiProvider === 'nvidia'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
            }`}
          >
            {isAnimatingImage ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {videoAiProvider === 'nvidia'
                    ? `Animating Photo via NVIDIA (${videoNvidiaModel.split('/')[1] || videoNvidiaModel})...`
                    : 'Animating Photo with Veo 3...'}
                </span>
              </>
            ) : (
              <>
                {videoAiProvider === 'nvidia' ? <Cpu className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                <span>
                  {videoAiProvider === 'nvidia'
                    ? `Animate Photo via NVIDIA (${videoNvidiaModel.split('/')[1] || videoNvidiaModel})`
                    : 'Animate Photo into Motion Video'}
                </span>
              </>
            )}
          </button>

          {isAnimatingImage && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-2 text-center">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <div className="text-xs font-bold text-white">{animateProgressMsg}</div>
            </div>
          )}

          {animateVideoUrl && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Brought to Life (Veo Motion)</span>
                <a
                  href={animateVideoUrl}
                  download="animated-memory.mp4"
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video</span>
                </a>
              </div>
              <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video src={animateVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
              </div>
            </div>
          )}

          {animateError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{animateError}</span>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. GEMINI 4 ARGON MULTI-TURN STRATEGIC CHAT */}
      {/* ==================================================== */}
      {activeTab === 'chat' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Dynamic AI Model Chat</h2>
                <p className="text-xs text-slate-400">
                  {chatAiProvider === 'nvidia'
                    ? `NVIDIA NIM • ${AVAILABLE_NVIDIA_MODELS.find((m) => m.id === chatNvidiaModel)?.name || chatNvidiaModel}`
                    : 'Google Gemini 4 Argon / 3.8 Flash / 3.1 Lite'}
                </p>
              </div>
            </div>

            {/* Provider & Model Router */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Provider Switcher */}
              <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setChatAiProvider('gemini')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                    chatAiProvider === 'gemini'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setChatAiProvider('nvidia')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                    chatAiProvider === 'nvidia'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-emerald-300" />
                  NVIDIA NIM
                </button>
              </div>

              {/* Model selection based on provider */}
              {chatAiProvider === 'gemini' ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Reasoning:</span>
                  {(['complex', 'general', 'fast'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setTaskComplexity(lvl)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${
                        taskComplexity === lvl
                          ? lvl === 'complex'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : lvl === 'general'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {lvl === 'complex' ? 'Argon 4' : lvl === 'general' ? 'Flash 3.8' : 'Lite 3.1'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Model:</span>
                  <select
                    value={chatNvidiaModel}
                    onChange={(e) => {
                      setChatNvidiaModel(e.target.value);
                      localStorage.setItem('aura_nvidia_model', e.target.value);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium font-mono focus:outline-none"
                  >
                    {AVAILABLE_NVIDIA_MODELS.filter((m) => !m.supportsImageGen).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Persona Role Selection */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {CHAT_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => {
                  setSelectedRole(role.id);
                  setTaskComplexity(role.defaultComplexity);
                }}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  selectedRole === role.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{role.label.split('&')[0]}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages Thread */}
          <div className="h-80 overflow-y-auto space-y-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            {chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-500 px-1">
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className="font-bold text-amber-400">({msg.modelUsed})</span>
                    )}
                  </div>
                </div>
              );
            })}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-400 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {taskComplexity === 'complex'
                    ? 'gemini-4-argon deep reasoning underway...'
                    : 'Generating response...'}
                </span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
              placeholder={`Ask as ${CHAT_ROLES.find((r) => r.id === selectedRole)?.label}...`}
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSendChatMessage}
              disabled={!chatInput.trim() || isChatLoading}
              className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MUSIC STUDIO (Google Lyria & NVIDIA NIM) */}
      {/* ==================================================== */}
      {activeTab === 'music' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AI Music Studio</h2>
                <p className="text-xs text-slate-400">
                  {musicAiProvider === 'nvidia'
                    ? `NVIDIA NIM: ${musicNvidiaModel}`
                    : 'Google Lyria 3 (clip-preview & pro-preview)'}
                </p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setMusicMode('clip')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  musicMode === 'clip' ? 'bg-pink-600 text-white' : 'text-slate-400'
                }`}
              >
                Clip (30s)
              </button>
              <button
                onClick={() => setMusicMode('pro')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  musicMode === 'pro' ? 'bg-pink-600 text-white' : 'text-slate-400'
                }`}
              >
                Pro Track
              </button>
            </div>
          </div>

          {/* AI Engine Selector: Google Lyria vs NVIDIA NIM */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-pink-400" />
              <span>Music Engine:</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMusicAiProvider('gemini')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  musicAiProvider === 'gemini'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-950/50 ring-1 ring-pink-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                <span>Google Lyria 3</span>
              </button>
              <button
                type="button"
                onClick={() => setMusicAiProvider('nvidia')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  musicAiProvider === 'nvidia'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-300" />
                <span>NVIDIA NIM</span>
              </button>
            </div>
          </div>

          {/* NVIDIA NIM Music Model Selector */}
          {musicAiProvider === 'nvidia' && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chosen NVIDIA Model:</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono">
                  ACTIVE
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
                    name: 'NVIDIA Nemotron 3.5 Lightning 30B',
                    tag: 'Ultra-fast MoE 30B - Rhythmic & Musical Structure',
                  },
                  {
                    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
                    name: 'NVIDIA Llama 3.1 Nemotron 70B',
                    tag: 'High-Intelligence 70B - Deep Harmonic Composition',
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMusicNvidiaModel(m.id);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('aura_nvidia_music_model', m.id);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                      musicNvidiaModel === m.id
                        ? 'bg-emerald-900/40 border-emerald-500/60 text-white ring-1 ring-emerald-400/50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{m.name}</span>
                      {musicNvidiaModel === m.id && (
                        <span className="text-[10px] font-bold text-emerald-400">âœ“ Selected</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.tag}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Music Prompt & Mood:
            </label>
            <textarea
              rows={3}
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              placeholder="Describe the musical genre, tempo, instruments, and emotional arc (e.g. Tamil classical veena melody blended with deep ambient chillhop beats, tranquil and uplifting)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* Quick Style Presets */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              'Billionaire Focus Lo-Fi Beats',
              'Tamil Classical Veena Ambient Fusion',
              'Maaran STEM Robotics Synthwave',
              'Sanctuary Family Meditation Lullaby',
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setMusicPrompt(p)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>

          {/* Optional Image Inspiration */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Inspiring Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMusicImageUpload}
                  className="hidden"
                />
              </label>
              {musicImagePreview && (
                <span className="text-[11px] text-pink-400 font-semibold">Image loaded as melody cue</span>
              )}
            </div>

            {musicImagePreview && (
              <img
                src={musicImagePreview}
                alt="Inspire preview"
                className="w-10 h-10 rounded-lg object-cover border border-pink-500/30"
              />
            )}
          </div>

          <button
            onClick={handleGenerateMusic}
            disabled={!musicPrompt.trim() || isGeneratingMusic}
            className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-white ${
              musicAiProvider === 'nvidia'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-pink-600 hover:bg-pink-500 shadow-pink-600/30'
            }`}
          >
            {isGeneratingMusic ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {musicAiProvider === 'nvidia'
                    ? `Synthesizing Track with NVIDIA NIM (${musicNvidiaModel.split('/')[1] || musicNvidiaModel})...`
                    : 'Synthesizing Track with Lyria...'}
                </span>
              </>
            ) : (
              <>
                {musicAiProvider === 'nvidia' ? <Cpu className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                <span>
                  {musicAiProvider === 'nvidia'
                    ? `Generate Track via NVIDIA (${musicNvidiaModel.split('/')[1] || musicNvidiaModel})`
                    : 'Generate Track with Lyria 3'}
                </span>
              </>
            )}
          </button>

          {/* Music Result Player */}
          {musicResult && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-pink-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayMusic}
                    className="w-9 h-9 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shadow-md shadow-pink-600/30"
                  >
                    {isMusicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div>
                    <div className="font-bold text-white">Lyria Composition</div>
                    <div className="text-[10px] text-slate-400">Model: {musicResult.modelUsed}</div>
                  </div>
                </div>

                <a
                  href={musicResult.audioUrl}
                  download="lyria-composition.wav"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1 border border-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download WAV</span>
                </a>
              </div>

              <audio
                ref={musicAudioRef}
                src={musicResult.audioUrl}
                onPlay={() => setIsMusicPlaying(true)}
                onPause={() => setIsMusicPlaying(false)}
                controls
                className="w-full h-9 rounded-lg"
              />

              {musicResult.lyrics && (
                <div className="text-xs text-slate-300 italic p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  "{musicResult.lyrics}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. BANANA IMAGE STUDIO & EDITOR (gemini-nano-banana-2.1) */}
      {/* ==================================================== */}
      {activeTab === 'images' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Banana Image Studio & Editor</h2>
                <p className="text-xs text-slate-400">Model: gemini-nano-banana-2.1</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Image Generation or Editing Prompt:
            </label>
            <textarea
              rows={3}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="e.g. Create a photorealistic 4K portrait of modern sovereign executive sanctuary, floor-to-ceiling glass, sapphire accents..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Optional Source Image for Editing */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo to Edit (Optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSourceImageUpload}
                  className="hidden"
                />
              </label>
              {sourceImagePreview && (
                <span className="text-[11px] text-emerald-400 font-semibold">Ready for conversational edit</span>
              )}
            </div>

            {sourceImagePreview && (
              <img
                src={sourceImagePreview}
                alt="Source preview"
                className="w-10 h-10 rounded-lg object-cover border border-emerald-500/30"
              />
            )}
          </div>

          {/* AI Engine Provider Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Image Foundation Engine:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImageAiProvider('gemini')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  imageAiProvider === 'gemini'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Google Imagen 3</span>
              </button>
              <button
                type="button"
                onClick={() => setImageAiProvider('nvidia')}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  imageAiProvider === 'nvidia'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  NVIDIA NIM (
                  {AVAILABLE_NVIDIA_MODELS.find((m) => m.id === imageNvidiaModel)?.name?.replace('Stable Diffusion', 'SD') ||
                    'SD 3'}
                  )
                </span>
              </button>
            </div>
          </div>

          {/* NVIDIA NIM Model Selector */}
          {imageAiProvider === 'nvidia' && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chosen NVIDIA Model:</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  {AVAILABLE_NVIDIA_MODELS.find((m) => m.id === imageNvidiaModel)?.badge || 'NVIDIA NIM'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {AVAILABLE_NVIDIA_MODELS.filter((m) => m.supportsImageGen).map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setImageNvidiaModel(model.id);
                      localStorage.setItem('aura_nvidia_image_model', model.id);
                    }}
                    className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
                      imageNvidiaModel === model.id
                        ? 'bg-emerald-600/30 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-bold text-xs truncate">{model.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">{model.id}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aspect Ratio, Resolution & Grounding Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Aspect Ratio</label>
              <select
                value={imageAspectRatio}
                onChange={(e) => setImageAspectRatio(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
              >
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Portrait / Story</option>
                <option value="4:3">4:3 Standard</option>
                <option value="3:4">3:4 Vertical</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Resolution</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
              >
                <option value="1K">1K Standard (Fast)</option>
                <option value="2K">2K High Definition</option>
                <option value="4K">4K Ultra Resolution</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Search Grounding</label>
              <button
                type="button"
                onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                className={`w-full py-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  useSearchGrounding
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>{useSearchGrounding ? 'Google Search ON' : 'Grounding Off'}</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerateOrEditImage}
            disabled={!imagePrompt.trim() || isGeneratingImage}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            {isGeneratingImage ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  {imageAiProvider === 'nvidia'
                    ? `Rendering via NVIDIA NIM (${imageNvidiaModel})...`
                    : 'Rendering High-Resolution Image via Google Imagen 3...'}
                </span>
              </>
            ) : (
              <>
                {imageAiProvider === 'nvidia' ? <Cpu className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                <span>
                  {imageAiProvider === 'nvidia'
                    ? `Generate Artwork via NVIDIA (${AVAILABLE_NVIDIA_MODELS.find((m) => m.id === imageNvidiaModel)?.name || imageNvidiaModel})`
                    : 'Generate / Edit with Google Imagen 3'}
                </span>
              </>
            )}
          </button>

          {/* Generated Image Preview */}
          {imageResult && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">Generated Artwork</span>
                  <span className="text-[10px] text-slate-400 ml-2">({imageResult.modelUsed})</span>
                </div>
                {imageResult.imageUrl && (
                  <a
                    href={imageResult.imageUrl}
                    download="banana-artwork.png"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </a>
                )}
              </div>

              {imageResult.imageUrl && (
                <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-96">
                  <img
                    src={imageResult.imageUrl}
                    alt="Generated artwork"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              )}

              {imageResult.text && (
                <div className="text-xs text-slate-300 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  {imageResult.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. AURO LIVE VOICE CONVERSATION HUB */}
      {/* ==================================================== */}
      {activeTab === 'live-voice' && (
        <div className="rounded-3xl p-5 bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AURO Real-Time Voice Hub</h2>
                <p className="text-xs text-slate-400">Live Voice Turns & Conversational Cadence</p>
              </div>
            </div>
            {onOpenVoiceAssistant && (
              <button
                onClick={onOpenVoiceAssistant}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-md shadow-indigo-600/30"
              >
                <span>Full-Screen AURO</span>
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Directly test voice turns and responses with AURO using dual voice synthesizers: server-side Gemini Natural TTS and browser-native low-latency speech synthesis.
          </p>

          {/* Quick Voice Prompt Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              'Aura, give me a quick morning briefing on our family milestones and wealth goals.',
              'Aura, check in on Maaran robotics project progress and Selvapriya wellness status.',
              'Aura, what is our top sovereign priority today for executive life OS?',
              'Aura, tell me an inspiring thought on resilience and generational wealth.',
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setLiveVoiceInput(p);
                  handleSendLiveVoiceTurn(p);
                }}
                className="p-3 rounded-2xl bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 text-left text-slate-300 hover:text-white transition-all flex items-start gap-2"
              >
                <Volume2 className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                <span>{p}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={liveVoiceInput}
              onChange={(e) => setLiveVoiceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendLiveVoiceTurn()}
              placeholder="Ask AURO anything to speak aloud..."
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={() => handleSendLiveVoiceTurn()}
              disabled={!liveVoiceInput.trim() || isLiveVoiceLoading}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-pink-600/30"
            >
              {isLiveVoiceLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
              <span>Speak</span>
            </button>
          </div>

          {liveVoiceReply && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-pink-500/30 space-y-2">
              <div className="text-xs font-bold text-pink-400">AURO Live Response:</div>
              <div className="text-xs text-slate-200 leading-relaxed italic">
                "{liveVoiceReply.text}"
              </div>
              {liveVoiceReply.audioUrl && (
                <audio src={liveVoiceReply.audioUrl} controls autoPlay className="w-full h-8 mt-2" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 8. FAMILY CIRCLE DRIVE & CREATIONS HISTORY DASHBOARD */}
      {/* ==================================================== */}
      {activeTab === 'history' && (
        <AiCreationsHistoryDashboard
          onOpenSubTab={(subTab: string) => setActiveTab(subTab as AiStudioSubTab)}
        />
      )}
      {/* AI Model Config Modal */}
      <AiModelConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
};
