import { useEffect, useRef } from "react";
import { getAnalyser } from "@/lib/audio-capture";

interface WaveformVisualizerProps {
  readonly active: boolean;
}

export function WaveformVisualizer({ active }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      // Draw flat line when inactive
      drawFlatLine();
      return;
    }

    function draw() {
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
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      const analyser = getAnalyser();
      if (!analyser) {
        drawStaticWave(ctx, w, h, midY);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Main waveform
      ctx.beginPath();
      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * midY;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.strokeStyle = "rgba(0, 210, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glow layer
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * midY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.shadowColor = "rgba(0, 210, 255, 0.4)";
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(0, 210, 255, 0.2)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center line
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  function drawFlatLine() {
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
    const midY = rect.height / 2;

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.strokeStyle = "rgba(0, 210, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 48 }}
    />
  );
}

function drawStaticWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  midY: number,
) {
  const t = performance.now() / 1000;
  ctx.beginPath();

  for (let x = 0; x < w; x++) {
    const normalized = x / w;
    const y =
      midY +
      Math.sin(normalized * 8 + t * 2) * 2 +
      Math.sin(normalized * 12 + t * 3) * 1;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = "rgba(0, 210, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
