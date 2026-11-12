import * as THREE from 'three';
import type { PhoneScreenId } from '@/lib/sceneState';

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

export function createBakedScreenTexture(screen: PhoneScreenId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#0E1420');
    grad.addColorStop(1, '#090C12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1024);

    // Dynamic island
    ctx.fillStyle = '#04060A';
    drawRoundRect(ctx, 181, 34, 150, 34, 17);
    ctx.fill();

    // Header
    ctx.fillStyle = '#9AA6B8';
    ctx.font = '600 18px monospace';
    ctx.fillText('MEDBUDDY', 38, 114);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    drawRoundRect(ctx, 336, 92, 138, 30, 15);
    ctx.stroke();
    ctx.fillStyle = '#9AA6B8';
    ctx.font = '600 15px monospace';
    ctx.fillText('ILLUSTRATIVE', 350, 113);

    const titles: Record<PhoneScreenId, [string, string]> = {
      cabinet: ['Home Cabinet', 'Sorted by expiry & opened date'],
      reminder: ['Evening Dose', 'Scheduled for 8:00 PM'],
      refill: ['Refill Alerts', 'Based on quantity & daily dose'],
      family: ['Family Care', 'Shared adherence overview'],
    };

    const [title, subtitle] = titles[screen];
    ctx.fillStyle = '#EAF0F6';
    ctx.font = '400 46px Georgia, serif';
    ctx.fillText(title, 38, 186);

    ctx.fillStyle = '#9AA6B8';
    ctx.font = '400 21px sans-serif';
    ctx.fillText(subtitle, 38, 224);

    const rows: Record<PhoneScreenId, Array<[string, string, string, string]>> = {
      cabinet: [
        ['Metformin 500 mg', 'Kitchen shelf · 42 tablets', 'IN DATE · 148 DAYS', '#5CF2C7'],
        ['Eye Drops (Opened)', 'Bedside · Opened 18d ago', 'USE SOON · 10 DAYS', '#FFB347'],
        ['Cough Syrup', 'Bathroom · Safe disposal', 'EXPIRED · 3 DAYS AGO', '#FF4D6A'],
      ],
      reminder: [
        ['Vitamin D3 1000 IU', '1 tablet · Stock updates on log', 'DUE NOW · TAKEN / SKIP', '#5CF2C7'],
        ['Morning Dose', 'Logged at 8:12 AM · 28 left', 'COMPLETED', '#9AA6B8'],
        ['Evening Schedule', 'Reminder active at 8:00 PM', 'ON SCHEDULE', '#5CF2C7'],
      ],
      refill: [
        ['Metformin 500 mg', '10 tablets left at 2/day', '5 DAYS REMAINING', '#FFB347'],
        ['Calcium Citrate', '18 tablets · 18 days left', 'ENOUGH STOCK', '#5CF2C7'],
        ['Vitamin D3 1000 IU', '28 tablets · 28 days left', 'ENOUGH STOCK', '#5CF2C7'],
      ],
      family: [
        ['Mom · Evening Dose', 'Logged Taken at 8:04 PM', 'ALL LOGGED TODAY', '#5CF2C7'],
        ['Missed Dose Rule', 'Caregiver alerted after 30 min', 'ACTIVE MONITOR', '#FF4D6A'],
        ['Adherence Report', 'Doctor-ready PDF export', 'READY', '#DDE6F0'],
      ],
    };

    rows[screen].forEach(([name, desc, status, color], idx) => {
      const y = 276 + idx * 172;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = color === '#FF4D6A' ? 'rgba(255,77,106,0.48)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 38, y, 436, 148, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#EAF0F6';
      ctx.font = '600 24px sans-serif';
      ctx.fillText(name, 62, y + 48);

      ctx.fillStyle = '#9AA6B8';
      ctx.font = '400 19px sans-serif';
      ctx.fillText(desc, 62, y + 84);

      ctx.fillStyle = color;
      ctx.font = '600 17px monospace';
      ctx.fillText(status, 62, y + 122);
    });

    // Bottom dock
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    drawRoundRect(ctx, 38, 888, 436, 86, 43);
    ctx.fill();

    ctx.fillStyle = '#EAF0F6';
    drawRoundRect(ctx, 52, 902, 198, 58, 29);
    ctx.fill();

    ctx.fillStyle = '#090C12';
    ctx.font = '700 21px sans-serif';
    ctx.fillText('Log dose', 108, 938);

    ctx.fillStyle = '#EAF0F6';
    ctx.font = '500 21px sans-serif';
    ctx.fillText('Scan strip', 312, 938);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
