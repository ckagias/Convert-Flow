// Canvas background: moving dots with lines between nearby ones.

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 80;
const MAX_LINK_DIST  = 160;  // px distance at which nodes connect
const SPEED          = 0.35; // max velocity per axis
const PARTICLE_COLOR = "34, 211, 238"; // rgb of cyan-400
const BG_COLOR       = "#060b14";

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width  = window.innerWidth;
    let height = window.innerHeight;
    canvas.width  = width;
    canvas.height = height;

    /* Create the dots with random position and speed */
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  randomBetween(0, width),
      y:  randomBetween(0, height),
      vx: randomBetween(-SPEED, SPEED),
      vy: randomBetween(-SPEED, SPEED),
      r:  randomBetween(1.2, 2.5),
      opacity: randomBetween(0.4, 0.9),
    }));

    /* Update canvas size when the window is resized */
    const onResize = () => {
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width;
      canvas.height = height;
    };
    window.addEventListener("resize", onResize);

    let animId;

    const draw = () => {
      /* Clear the canvas (slightly transparent for a soft trail) */
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      /* Move each dot and draw it */
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        /* Wrap position when dot goes off screen */
        if (p.x < -10)          { p.x = width + 10;  }
        if (p.x > width + 10)   { p.x = -10;          }
        if (p.y < -10)          { p.y = height + 10; }
        if (p.y > height + 10)  { p.y = -10;          }

        /* Draw one dot */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, ${p.opacity})`;
        ctx.fill();
      }

      /* Draw lines between dots that are close to each other */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx  = a.x - b.x;
          const dy  = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_LINK_DIST) {
            /* Line is fainter when dots are farther apart */
            const lineOpacity = (1 - dist / MAX_LINK_DIST) * 0.35;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${lineOpacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 w-full h-full"
        aria-hidden="true"
      />

      {/* Subtle radial nebula glow — blue/purple tones for depth */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 25% 35%, rgba(34,100,200,0.08) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 75% 65%, rgba(100,60,180,0.06) 0%, transparent 55%)",
        }}
      />

      {/* Vignette — darkens edges to focus attention on center content */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 45%, rgba(6,11,20,0.85) 100%)",
        }}
      />
    </>
  );
}
