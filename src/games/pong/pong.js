/**
 * Canvas 2D Pong — paddle vs bot.
 * Extracted from production class `Rx` (arena.pretty.js).
 *
 * Controls: A/D or ArrowLeft/ArrowRight; pointer drag on canvas.
 */

/**
 * @typedef {{ scoreYou: number, scoreBot: number, message: string }} PongHud
 */

export class PongGame {
  canvas;
  ctx;
  raf = 0;
  disposed = false;
  last = 0;
  w = 0;
  h = 0;

  ball = { x: 0, y: 0, vx: 0, vy: 0, r: 10 };
  you = { x: 0, y: 0, w: 90, h: 14, speed: 520 };
  bot = { x: 0, y: 0, w: 90, h: 14, speed: 280 };

  pointerX = null;
  keys = new Set();
  scoreYou = 0;
  scoreBot = 0;
  serveToYou = true;
  pauseT = 0.8;

  /** @type {(hud: PongHud) => void} */
  onHud;
  onKeyDown;
  onKeyUp;
  onPointer;
  onResize;

  /**
   * @param {HTMLElement} root
   * @param {(hud: PongHud) => void} onHud
   */
  constructor(root, onHud) {
    this.onHud = onHud;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pong-canvas';
    this.canvas.style.touchAction = 'none';
    root.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;

    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onPointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = ((e.clientX - rect.left) / rect.width) * this.w;
      e.preventDefault();
    };
    this.onResize = () => this.resize();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('pointerdown', this.onPointer, { passive: false });
    this.canvas.addEventListener('pointermove', this.onPointer, { passive: false });
    window.addEventListener('resize', this.onResize);

    this.resize();
    this.resetBall(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.pushHud('Rally — move paddle');
  }

  resize() {
    const parent = this.canvas.parentElement;
    const tw = parent?.clientWidth || window.innerWidth;
    const th = parent?.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.w = tw;
    this.h = th;
    this.canvas.width = Math.floor(tw * dpr);
    this.canvas.height = Math.floor(th * dpr);
    this.canvas.style.width = `${tw}px`;
    this.canvas.style.height = `${th}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.you.w = Math.min(110, tw * 0.22);
    this.bot.w = this.you.w;
    this.you.y = th - 36;
    this.bot.y = 28;
    this.you.x = Math.min(this.you.x || tw / 2, tw - this.you.w);
    this.bot.x = Math.min(this.bot.x || tw / 2, tw - this.bot.w);
    this.ball.r = Math.max(8, Math.min(12, tw * 0.018));
  }

  /** @param {boolean} toYou */
  resetBall(toYou) {
    this.ball.x = this.w / 2;
    this.ball.y = this.h / 2;
    const speed = Math.min(380, 260 + (this.scoreYou + this.scoreBot) * 12);
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    this.ball.vx = Math.sin(angle) * speed;
    this.ball.vy = (toYou ? 1 : -1) * Math.cos(angle) * speed;
    this.pauseT = 0.75;
    this.serveToYou = toYou;
  }

  /** @param {string} message */
  pushHud(message) {
    this.onHud({
      scoreYou: this.scoreYou,
      scoreBot: this.scoreBot,
      message,
    });
  }

  frame = (t) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
  };

  /** @param {number} dt */
  update(dt) {
    let move = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) move -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) move += 1;

    if (this.pointerX != null) {
      const target = this.pointerX - this.you.w / 2;
      this.you.x += (target - this.you.x) * Math.min(1, dt * 14);
    } else {
      this.you.x += move * this.you.speed * dt;
    }
    this.you.x = Math.max(8, Math.min(this.w - this.you.w - 8, this.you.x));

    const err = this.ball.x - this.bot.w / 2 - this.bot.x;
    const step = Math.sign(err) * Math.min(Math.abs(err), this.bot.speed * dt);
    this.bot.x += step;
    this.bot.x = Math.max(8, Math.min(this.w - this.bot.w - 8, this.bot.x));

    if (this.pauseT > 0) {
      this.pauseT -= dt;
      return;
    }

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x - this.ball.r < 0) {
      this.ball.x = this.ball.r;
      this.ball.vx *= -1;
    } else if (this.ball.x + this.ball.r > this.w) {
      this.ball.x = this.w - this.ball.r;
      this.ball.vx *= -1;
    }

    this.hitPaddle(this.you, 1);
    this.hitPaddle(this.bot, -1);

    if (this.ball.y > this.h + 20) {
      this.scoreBot += 1;
      this.pushHud('Bot scores');
      this.resetBall(false);
    } else if (this.ball.y < -20) {
      this.scoreYou += 1;
      this.pushHud('Point!');
      this.resetBall(true);
    }
  }

  /**
   * @param {typeof this.you} paddle
   * @param {1|-1} facing 1 = you (bottom), -1 = bot (top)
   */
  hitPaddle(paddle, facing) {
    const b = this.ball;
    if (facing > 0) {
      if (
        b.vy > 0 &&
        b.y + b.r >= paddle.y &&
        b.y + b.r <= paddle.y + paddle.h + 8 &&
        b.x >= paddle.x - 4 &&
        b.x <= paddle.x + paddle.w + 4
      ) {
        b.y = paddle.y - b.r;
        b.vy = -Math.abs(b.vy) * 1.03;
        const hit = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        b.vx += hit * 180;
        this.clampSpeed();
      }
    } else if (
      b.vy < 0 &&
      b.y - b.r <= paddle.y + paddle.h &&
      b.y - b.r >= paddle.y - 8 &&
      b.x >= paddle.x - 4 &&
      b.x <= paddle.x + paddle.w + 4
    ) {
      b.y = paddle.y + paddle.h + b.r;
      b.vy = Math.abs(b.vy) * 1.03;
      const hit = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      b.vx += hit * 160;
      this.clampSpeed();
    }
  }

  clampSpeed() {
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    const max = 520;
    const min = 220;
    if (speed > max) {
      this.ball.vx = (this.ball.vx / speed) * max;
      this.ball.vy = (this.ball.vy / speed) * max;
    } else if (speed < min) {
      this.ball.vx = (this.ball.vx / speed) * min;
      this.ball.vy = (this.ball.vy / speed) * min;
    }
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#1a4a3a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(232,226,212,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.beginPath();
    ctx.moveTo(12, h / 2);
    ctx.lineTo(w - 12, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(40, w * 0.08), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(this.you.x, this.you.y, this.you.w, this.you.h);
    ctx.fillStyle = '#d4652f';
    ctx.fillRect(this.bot.x, this.bot.y, this.bot.w, this.bot.h);

    ctx.beginPath();
    ctx.fillStyle = '#ffe08a';
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (this.pauseT > 0) {
      ctx.fillStyle = 'rgba(232,226,212,0.7)';
      ctx.font = '600 14px IBM Plex Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.serveToYou ? 'Your serve' : 'Bot serve', w / 2, h / 2 - 24);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
  }
}
