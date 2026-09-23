/** Keyboard + touch stick input for Grid Defense */

export class FlightInput {
  keys = new Set();
  stick = { x: 0, y: 0 };
  touchGun = false;
  touchMissile = false;
  touchFlare = false;
  #cleanups = [];

  constructor() {
    const down = (e) => {
      this.keys.add(e.code);
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.#cleanups.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    });
  }

  bindHud(hudEl) {
    if (!hudEl) return;
    const stick = hudEl.querySelector('[data-touch="stick"]');
    const knob = hudEl.querySelector('[data-touch="knob"]');
    const fire = hudEl.querySelector('[data-touch="fire"]');
    const missile = hudEl.querySelector('[data-touch="missile"]');
    const flare = hudEl.querySelector('[data-touch="flare"]');

    if (stick && knob) {
      const radius = () => stick.clientWidth * 0.32;
      const setStick = (clientX, clientY) => {
        const rect = stick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const r = radius();
        const len = Math.hypot(dx, dy) || 1;
        if (len > r) {
          dx = (dx / len) * r;
          dy = (dy / len) * r;
        }
        this.stick.x = dx / r;
        this.stick.y = dy / r;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        stick.classList.add('active');
      };
      const resetStick = () => {
        this.stick.x = 0;
        this.stick.y = 0;
        knob.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('active');
      };
      let pointerId = null;
      const onDown = (e) => {
        pointerId = e.pointerId;
        stick.setPointerCapture?.(pointerId);
        setStick(e.clientX, e.clientY);
        e.preventDefault();
      };
      const onMove = (e) => {
        if (pointerId != null && e.pointerId !== pointerId) return;
        setStick(e.clientX, e.clientY);
        e.preventDefault();
      };
      const onUp = (e) => {
        if (pointerId != null && e.pointerId !== pointerId) return;
        pointerId = null;
        resetStick();
      };
      stick.addEventListener('pointerdown', onDown, { passive: false });
      stick.addEventListener('pointermove', onMove, { passive: false });
      stick.addEventListener('pointerup', onUp);
      stick.addEventListener('pointercancel', onUp);
      this.#cleanups.push(() => {
        stick.removeEventListener('pointerdown', onDown);
        stick.removeEventListener('pointermove', onMove);
        stick.removeEventListener('pointerup', onUp);
        stick.removeEventListener('pointercancel', onUp);
      });
    }

    const bindHold = (btn, setter) => {
      if (!btn) return;
      const on = (e) => {
        setter(true);
        btn.classList.add('pressed');
        e.preventDefault();
      };
      const off = () => {
        setter(false);
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', on, { passive: false });
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
      this.#cleanups.push(() => {
        btn.removeEventListener('pointerdown', on);
        btn.removeEventListener('pointerup', off);
        btn.removeEventListener('pointerleave', off);
        btn.removeEventListener('pointercancel', off);
      });
    };

    bindHold(fire, (v) => (this.touchGun = v));
    bindHold(missile, (v) => (this.touchMissile = v));
    bindHold(flare, (v) => (this.touchFlare = v));
  }

  get pitch() {
    let v = this.stick.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) v -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) v += 1;
    return Math.max(-1, Math.min(1, v));
  }

  get bank() {
    let v = this.stick.x;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) v -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) v += 1;
    return Math.max(-1, Math.min(1, v));
  }

  get gun() {
    return this.keys.has('Space') || this.touchGun;
  }

  get missile() {
    return this.keys.has('KeyE') || this.touchMissile;
  }

  get flare() {
    return this.keys.has('KeyQ') || this.touchFlare;
  }

  get pause() {
    return this.keys.has('Escape');
  }

  dispose() {
    for (const fn of this.#cleanups) fn();
    this.#cleanups.length = 0;
  }
}
