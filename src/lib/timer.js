import { TIME_SCALE } from './util.js';

/* Pausable countdown. seconds are real-test seconds (compressed in ?fast=1 self-test mode). */
export class Timer {
  constructor(seconds, { onTick, onEnd } = {}) {
    this.total = seconds * TIME_SCALE; this.left = this.total;
    this.onTick = onTick || (() => { }); this.onEnd = onEnd || (() => { });
    this.running = false; this.ended = false; this._h = null; this._last = 0;
  }
  start() {
    if (this.running || this.ended) return this;
    this.running = true; this._last = performance.now();
    this._h = setInterval(() => this._step(), 200);
    this.onTick(this.display(), this); return this;
  }
  _step() {
    const now = performance.now(); this.left -= (now - this._last) / 1000; this._last = now;
    if (this.left <= 0) { this.left = 0; this.stop(); this.ended = true; this.onTick(0, this); this.onEnd(this); return; }
    this.onTick(this.display(), this);
  }
  display() { return this.left / TIME_SCALE; }
  totalSeconds() { return this.total / TIME_SCALE; }
  fraction() { return this.total ? 1 - this.left / this.total : 1; }
  pause() { if (!this.running) return; this._step(); clearInterval(this._h); this.running = false; }
  resume() { this.start(); }
  stop() { clearInterval(this._h); this.running = false; }
}
