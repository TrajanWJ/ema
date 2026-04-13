import { useEffect, useRef, useCallback } from "react";
import type { VoiceState } from "@/stores/voice-store";

interface JarvisOrbProps {
  readonly state: VoiceState;
  readonly audioLevel: number;
  readonly onClick?: () => void;
}

// ── Color Configuration ──

const COLORS = {
  core: { r: 30, g: 144, b: 255 },      // Electric blue
  glow: { r: 0, g: 210, b: 255 },        // Cyan
  accent: { r: 138, g: 43, b: 226 },     // Purple
  ring: { r: 80, g: 200, b: 255 },       // Light cyan
  particle: { r: 100, g: 180, b: 255 },  // Soft blue
} as const;

// ── State-Driven Parameters ──

interface StateParams {
  coreRadius: number;
  glowIntensity: number;
  pulseSpeed: number;
  particleCount: number;
  particleSpeed: number;
  ringCount: number;
  ringRotationSpeed: number;
  breatheAmplitude: number;
  noiseIntensity: number;
}

const STATE_PARAMS: Record<VoiceState, StateParams> = {
  idle: {
    coreRadius: 0.28,
    glowIntensity: 0.4,
    pulseSpeed: 0.8,
    particleCount: 40,
    particleSpeed: 0.3,
    ringCount: 2,
    ringRotationSpeed: 0.2,
    breatheAmplitude: 0.03,
    noiseIntensity: 0.0,
  },
  listening: {
    coreRadius: 0.34,
    glowIntensity: 0.7,
    pulseSpeed: 1.5,
    particleCount: 80,
    particleSpeed: 0.8,
    ringCount: 3,
    ringRotationSpeed: 0.6,
    breatheAmplitude: 0.06,
    noiseIntensity: 0.5,
  },
  processing: {
    coreRadius: 0.30,
    glowIntensity: 0.9,
    pulseSpeed: 2.5,
    particleCount: 120,
    particleSpeed: 1.5,
    ringCount: 4,
    ringRotationSpeed: 1.2,
    breatheAmplitude: 0.02,
    noiseIntensity: 0.3,
  },
  speaking: {
    coreRadius: 0.26,
    glowIntensity: 0.5,
    pulseSpeed: 1.0,
    particleCount: 50,
    particleSpeed: 0.4,
    ringCount: 2,
    ringRotationSpeed: 0.3,
    breatheAmplitude: 0.04,
    noiseIntensity: 0.1,
  },
  error: {
    coreRadius: 0.24,
    glowIntensity: 0.3,
    pulseSpeed: 3.0,
    particleCount: 20,
    particleSpeed: 0.2,
    ringCount: 1,
    ringRotationSpeed: 0.1,
    breatheAmplitude: 0.01,
    noiseIntensity: 0.0,
  },
};

// ── Particle System ──

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  opacity: number;
  orbitSpeed: number;
  phase: number;
  drift: number;
}

function createParticle(maxRadius: number): Particle {
  return {
    angle: Math.random() * Math.PI * 2,
    radius: 0.3 + Math.random() * maxRadius * 0.6,
    speed: 0.001 + Math.random() * 0.003,
    size: 0.5 + Math.random() * 2,
    opacity: 0.2 + Math.random() * 0.6,
    orbitSpeed: (0.2 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1),
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 0.002,
  };
}

// ── Smooth Interpolation ──

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpParams(a: StateParams, b: StateParams, t: number): StateParams {
  return {
    coreRadius: lerp(a.coreRadius, b.coreRadius, t),
    glowIntensity: lerp(a.glowIntensity, b.glowIntensity, t),
    pulseSpeed: lerp(a.pulseSpeed, b.pulseSpeed, t),
    particleCount: Math.round(lerp(a.particleCount, b.particleCount, t)),
    particleSpeed: lerp(a.particleSpeed, b.particleSpeed, t),
    ringCount: Math.round(lerp(a.ringCount, b.ringCount, t)),
    ringRotationSpeed: lerp(a.ringRotationSpeed, b.ringRotationSpeed, t),
    breatheAmplitude: lerp(a.breatheAmplitude, b.breatheAmplitude, t),
    noiseIntensity: lerp(a.noiseIntensity, b.noiseIntensity, t),
  };
}

export function JarvisOrb({ state, audioLevel, onClick }: JarvisOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const currentParamsRef = useRef<StateParams>(STATE_PARAMS.idle);
  const targetParamsRef = useRef<StateParams>(STATE_PARAMS.idle);
  const timeRef = useRef(0);
  const audioLevelRef = useRef(0);

  // Update targets when state changes
  useEffect(() => {
    targetParamsRef.current = STATE_PARAMS[state] ?? STATE_PARAMS.idle;
  }, [state]);

  // Update audio level ref
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    const baseSize = Math.min(w, h);

    const dt = 0.016;
    timeRef.current += dt;
    const t = timeRef.current;

    // Smooth interpolation toward target params
    const current = currentParamsRef.current;
    const target = targetParamsRef.current;
    const params = lerpParams(current, target, 0.04);
    currentParamsRef.current = params;

    const audioLvl = audioLevelRef.current;

    // ── Clear ──
    ctx.clearRect(0, 0, w, h);

    // ── Breathing effect ──
    const breathe = Math.sin(t * params.pulseSpeed) * params.breatheAmplitude;
    const coreR = baseSize * (params.coreRadius + breathe + audioLvl * 0.05);

    // ── Outer ambient glow ──
    const ambientGrad = ctx.createRadialGradient(cx, cy, coreR * 0.5, cx, cy, coreR * 3);
    ambientGrad.addColorStop(0, `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, ${params.glowIntensity * 0.15})`);
    ambientGrad.addColorStop(0.4, `rgba(${COLORS.accent.r}, ${COLORS.accent.g}, ${COLORS.accent.b}, ${params.glowIntensity * 0.06})`);
    ambientGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Orbital rings ──
    for (let i = 0; i < params.ringCount; i++) {
      const ringR = coreR * (1.3 + i * 0.25);
      const rotation = t * params.ringRotationSpeed * (i % 2 === 0 ? 1 : -1) + i * 1.2;
      const tilt = 0.15 + i * 0.2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.scale(1, tilt);

      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${COLORS.ring.r}, ${COLORS.ring.g}, ${COLORS.ring.b}, ${0.08 + params.glowIntensity * 0.08})`;
      ctx.lineWidth = 1 + audioLvl * 2;
      ctx.stroke();

      // Ring glow
      ctx.shadowColor = `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, 0.3)`;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // ── Particle system ──
    const particles = particlesRef.current;

    // Adjust particle count
    while (particles.length < params.particleCount) {
      particles.push(createParticle(params.coreRadius));
    }
    while (particles.length > params.particleCount) {
      particles.pop();
    }

    for (const p of particles) {
      p.angle += p.orbitSpeed * params.particleSpeed * dt;
      p.radius += Math.sin(t * 2 + p.phase) * p.drift;
      p.radius = Math.max(0.15, Math.min(0.55, p.radius));

      const px = cx + Math.cos(p.angle) * p.radius * baseSize;
      const py = cy + Math.sin(p.angle) * p.radius * baseSize * 0.85;
      const displaySize = p.size * (1 + audioLvl * 1.5);

      // Particle with glow
      const pGrad = ctx.createRadialGradient(px, py, 0, px, py, displaySize * 3);
      pGrad.addColorStop(0, `rgba(${COLORS.particle.r}, ${COLORS.particle.g}, ${COLORS.particle.b}, ${p.opacity * params.glowIntensity})`);
      pGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = pGrad;
      ctx.fillRect(px - displaySize * 3, py - displaySize * 3, displaySize * 6, displaySize * 6);

      // Bright center
      ctx.beginPath();
      ctx.arc(px, py, displaySize * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.6 * params.glowIntensity})`;
      ctx.fill();
    }

    // ── Core orb ──
    // Inner noise distortion (when listening)
    if (params.noiseIntensity > 0.01) {
      ctx.save();
      ctx.beginPath();
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const noise = Math.sin(angle * 6 + t * 4) * Math.cos(angle * 3 + t * 2.5);
        const distortion = noise * coreR * params.noiseIntensity * (0.5 + audioLvl);
        const r = coreR + distortion;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${COLORS.core.r}, ${COLORS.core.g}, ${COLORS.core.b}, 0.08)`;
      ctx.fill();
      ctx.restore();
    }

    // Main core gradient
    const coreGrad = ctx.createRadialGradient(
      cx - coreR * 0.2, cy - coreR * 0.2, coreR * 0.05,
      cx, cy, coreR,
    );
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.25 + params.glowIntensity * 0.15})`);
    coreGrad.addColorStop(0.2, `rgba(${COLORS.core.r}, ${COLORS.core.g}, ${COLORS.core.b}, ${0.6 + params.glowIntensity * 0.3})`);
    coreGrad.addColorStop(0.6, `rgba(${COLORS.core.r}, ${COLORS.core.g}, ${COLORS.core.b}, 0.4)`);
    coreGrad.addColorStop(0.85, `rgba(${COLORS.accent.r}, ${COLORS.accent.g}, ${COLORS.accent.b}, 0.15)`);
    coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Core inner highlight
    const highlightGrad = ctx.createRadialGradient(
      cx - coreR * 0.3, cy - coreR * 0.3, 0,
      cx, cy, coreR * 0.7,
    );
    highlightGrad.addColorStop(0, `rgba(255, 255, 255, ${0.1 + audioLvl * 0.15})`);
    highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlightGrad;
    ctx.fill();

    // ── Core edge glow ──
    const edgeGrad = ctx.createRadialGradient(cx, cy, coreR * 0.85, cx, cy, coreR * 1.3);
    edgeGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    edgeGrad.addColorStop(0.5, `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, ${params.glowIntensity * 0.3})`);
    edgeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = edgeGrad;
    ctx.fill();

    // ── Pulsing ring ──
    const pulsePhase = (t * params.pulseSpeed) % (Math.PI * 2);
    const pulseR = coreR * (1.05 + Math.sin(pulsePhase) * 0.15 + audioLvl * 0.1);
    const pulseOpacity = (1 + Math.sin(pulsePhase)) * 0.5 * params.glowIntensity * 0.25;

    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, ${pulseOpacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Secondary expanding pulse (processing only) ──
    if (params.pulseSpeed > 2) {
      const expandPhase = (t * 1.2) % 3;
      if (expandPhase < 2) {
        const expandR = coreR * (1 + expandPhase * 0.5);
        const expandOpacity = Math.max(0, 1 - expandPhase / 2) * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, expandR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, ${expandOpacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    animRef.current = requestAnimationFrame(render);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [render]);

  return (
    <div className="relative flex items-center justify-center" onClick={onClick}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        style={{ maxWidth: 400, maxHeight: 400, aspectRatio: "1" }}
      />
      {/* State label */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tracking-[0.2em] uppercase"
        style={{
          color:
            state === "error"
              ? "var(--color-pn-error)"
              : `rgba(${COLORS.glow.r}, ${COLORS.glow.g}, ${COLORS.glow.b}, 0.6)`,
        }}
      >
        {state === "idle" && "ready"}
        {state === "listening" && "listening"}
        {state === "processing" && "thinking"}
        {state === "speaking" && "speaking"}
        {state === "error" && "error"}
      </div>
    </div>
  );
}
