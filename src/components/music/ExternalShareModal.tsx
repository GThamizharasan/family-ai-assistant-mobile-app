import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Mail,
  MessageCircle,
  Send,
  Cloud,
  X,
  Music,
} from 'lucide-react';
import { MusicTrack } from '../../types/music';

interface ExternalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: MusicTrack | null;
}

export const ExternalShareModal: React.FC<ExternalShareModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !track) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl =
    track.driveWebViewLink ||
    (track.audioUrl.startsWith('http') ? track.audioUrl : `${currentOrigin}/#music-${track.id}`);

  const shareText = `🎵 Listening to "${track.title}" by ${track.artist} on Aura Apple Music (Family Circle)`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      } else {
        const input = document.createElement('input');
        input.value = `${shareText}\n${shareUrl}`;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${track.title} - ${track.artist}`,
          text: shareText,
          url: shareUrl,
        });
        onClose();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share notice:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`Music Share: ${track.title} by ${track.artist}`)}&body=${encodeURIComponent(`${shareText}\n\nListen here:\n${shareUrl}`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Share Track Externally</h3>
              <p className="text-[10px] text-slate-400">Share with family, friends, or social apps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track Preview Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <img
            src={
              track.artworkUrl ||
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
            }
            alt={track.title}
            className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 shadow-md"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
            <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
            <span className="text-[9px] font-mono text-indigo-400 font-semibold">{track.genre}</span>
          </div>
        </div>

        {/* Quick External Actions Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 transition-all hover:scale-[1.02] text-xs font-semibold group shadow-sm"
          >
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span>WhatsApp</span>
          </a>

          {/* Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 text-sky-300 transition-all hover:scale-[1.02] text-xs font-semibold group shadow-sm"
          >
            <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
              <Send className="w-4 h-4" />
            </div>
            <span>Telegram</span>
          </a>

          {/* Email */}
          <a
            href={mailUrl}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 transition-all hover:scale-[1.02] text-xs font-semibold group shadow-sm"
          >
            <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <Mail className="w-4 h-4" />
            </div>
            <span>Email</span>
          </a>

          {/* Native OS Share Sheet */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 transition-all hover:scale-[1.02] text-xs font-semibold group shadow-sm text-left"
            >
              <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                <Share2 className="w-4 h-4" />
              </div>
              <span>More Apps...</span>
            </button>
          )}
        </div>

        {/* Copy Link Section */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Direct Share Link
          </label>
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-[11px] font-mono text-slate-300 px-2 focus:outline-none truncate"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Optional Google Drive Direct Link */}
        {track.driveWebViewLink && (
          <div className="pt-1">
            <a
              href={track.driveWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 text-xs text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Cloud className="w-3.5 h-3.5" />
                <span>Open in Family Circle Drive</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
