"use client";

import { useEffect, useRef } from "react";
import type {
  RenderObject,
  TemporalRenderConfiguration,
  Vec2,
} from "@/lib/challenge/types";

function positionAt(
  object: RenderObject,
  elapsedMs: number,
  width: number,
  height: number,
): Vec2 {
  let x = object.start.x;
  let y = object.start.y;
  let t0 = 0;

  for (const segment of object.segments) {
    const t1 = segment.endMs;
    const dt = Math.max(0, Math.min(elapsedMs, t1) - t0) / 1000;
    x += segment.velocity.x * dt;
    y += segment.velocity.y * dt;
    t0 = t1;
    if (elapsedMs <= t1) break;
  }

  const r = object.size;
  const bounce = (value: number, min: number, max: number) => {
    if (max <= min) return min;
    let v = value;
    while (v < min || v > max) {
      if (v < min) v = min + (min - v);
      if (v > max) v = max - (v - max);
    }
    return v;
  };

  return {
    x: bounce(x, r, width - r),
    y: bounce(y, r, height - r),
  };
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  object: RenderObject,
  pos: Vec2,
  selected: boolean,
) {
  const { size, shape, color } = object;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? "#f8fafc" : "rgba(255,255,255,0.25)";
  ctx.lineWidth = selected ? 3 : 1.5;

  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(-size, -size, size * 2, size * 2);
      break;
    case "triangle":
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      break;
    case "hexagon": {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * size;
        const py = Math.sin(a) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function hitTest(object: RenderObject, pos: Vec2, point: Vec2): boolean {
  const dx = point.x - pos.x;
  const dy = point.y - pos.y;
  return dx * dx + dy * dy <= (object.size + 4) * (object.size + 4);
}

export function TemporalChallenge({
  config,
  selectedObjectId,
  onSelect,
  onStarted,
}: {
  config: TemporalRenderConfiguration;
  selectedObjectId: string | null;
  onSelect: (objectId: string) => void;
  onStarted: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startRef = useRef<number | null>(null);
  const positionsRef = useRef<Map<string, Vec2>>(new Map());
  const selectedRef = useRef<string | null>(selectedObjectId);
  const onStartedRef = useRef(onStarted);
  const startedRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selectedObjectId;
    onStartedRef.current = onStarted;
  }, [selectedObjectId, onStarted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    startRef.current = null;
    startedRef.current = false;

    let frame = 0;
    const loop = (now: number) => {
      if (startRef.current === null) {
        startRef.current = now;
        if (!startedRef.current) {
          startedRef.current = true;
          onStartedRef.current();
        }
      }
      const elapsed = Math.min(config.durationMs * 2, now - startRef.current);

      ctx.clearRect(0, 0, config.width, config.height);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, config.width, config.height);
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < config.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, config.height);
        ctx.stroke();
      }
      for (let y = 0; y < config.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(config.width, y);
        ctx.stroke();
      }

      for (const object of config.objects) {
        const pos = positionAt(object, elapsed, config.width, config.height);
        positionsRef.current.set(object.id, pos);
        drawShape(ctx, object, pos, selectedRef.current === object.id);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [config]);

  const handlePointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = config.width / rect.width;
    const scaleY = config.height / rect.height;
    const point = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };

    for (let i = config.objects.length - 1; i >= 0; i -= 1) {
      const object = config.objects[i]!;
      const pos = positionsRef.current.get(object.id);
      if (pos && hitTest(object, pos, point)) {
        onSelect(object.id);
        return;
      }
    }
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={config.width}
        height={config.height}
        className="w-full max-w-full cursor-crosshair rounded-md border border-slate-700/80 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]"
        data-testid="temporal-canvas"
        onClick={(event) => handlePointer(event.clientX, event.clientY)}
        role="img"
        aria-label="Temporal object tracking challenge canvas"
      />
      <p className="text-xs text-slate-500">
        Objects animate on canvas. Select the object that matches the instruction, then verify.
      </p>
    </div>
  );
}
