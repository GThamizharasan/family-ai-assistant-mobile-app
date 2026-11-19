import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface NeuralCanvasBackdropProps {
  accentHex: string;
  secondaryHex: string;
  intensity?: number;
}

/**
 * Ambient 60fps glowing synaptic neural network backdrop.
 * Honors prefers-reduced-motion and renders strictly behind UI (pointer-events-none).
 */
export const NeuralCanvasBackdrop: React.FC<NeuralCanvasBackdropProps> = ({
  accentHex,
  secondaryHex,
  intensity = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef({ accentHex, secondaryHex });

  useEffect(() => {
    colorsRef.current = { accentHex, secondaryHex };
  }, [accentHex, secondaryHex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    const width = 640;
    const height = 420;
    canvas.width = width;
    canvas.height = height;

    const nodeCount = 26;
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45 * intensity,
      vy: (Math.random() - 0.5) * 0.45 * intensity,
      radius: 1.6 + (i % 3) * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));

    const drawFrame = (timeMs: number) => {
      ctx.clearRect(0, 0, width, height);
      const { accentHex: primary, secondaryHex: secondary } = colorsRef.current;
      const t = timeMs * 0.001;

      for (const n of nodes) {
        if (!prefersReduced) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 10 || n.x > width - 10) n.vx *= -1;
          if (n.y < 10 || n.y > height - 10) n.vy *= -1;
        }
      }

      // Draw synaptic axons
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.22;
            ctx.strokeStyle = primary;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            // Periodic traveling synaptic spark along subset of connections
            if (!prefersReduced && (i + j) % 7 === 0) {
              const progress = (t * 0.55 + (i * 0.17)) % 1;
              const sx = nodes[i].x + (nodes[j].x - nodes[i].x) * progress;
              const sy = nodes[i].y + (nodes[j].y - nodes[i].y) * progress;
              ctx.globalAlpha = alpha * 3;
              ctx.fillStyle = secondary;
              ctx.beginPath();
              ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Draw glowing soma nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + n.phase);
        ctx.globalAlpha = 0.28 + pulse * 0.35;
        ctx.fillStyle = i % 2 === 0 ? primary : secondary;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + pulse * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (!prefersReduced) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animId);
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 w-full h-full opacity-45 z-0"
    />
  );
};

interface CelebrationBurstProps {
  triggerKey: number;
  color: string;
}

const PARTICLE_VECTORS = [
  { x: -64, y: -48, rotate: -45 },
  { x: 68, y: -52, rotate: 45 },
  { x: -82, y: 12, rotate: -90 },
  { x: 84, y: 14, rotate: 90 },
  { x: -42, y: -78, rotate: -20 },
  { x: 46, y: -76, rotate: 20 },
  { x: 0, y: -88, rotate: 0 },
  { x: -54, y: 44, rotate: -135 },
  { x: 56, y: 42, rotate: 135 },
];

export const CelebrationBurst: React.FC<CelebrationBurstProps> = ({ triggerKey, color }) => {
  if (triggerKey <= 0) return null;

  return (
    <AnimatePresence>
      <div
        key={triggerKey}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      >
        <motion.div
          initial={{ scale: 0.4, opacity: 0.9 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-28 h-28 rounded-full border-2"
          style={{ borderColor: color, boxShadow: `0 0 32px ${color}` }}
        />
        {PARTICLE_VECTORS.map((vec, idx) => (
          <motion.span
            key={idx}
            initial={{ x: 0, y: 0, scale: 0.5, opacity: 1, rotate: 0 }}
            animate={{
              x: vec.x * 1.4,
              y: vec.y * 1.4,
              scale: [0.6, 1.3, 0],
              opacity: [1, 1, 0],
              rotate: vec.rotate,
            }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="absolute text-lg select-none"
          >
            {idx % 3 === 0 ? '✨' : idx % 3 === 1 ? '⚡' : '🌟'}
          </motion.span>
        ))}
      </div>
    </AnimatePresence>
  );
};

