"use strict";

class RosterBroadcaster {
  constructor(getWindows, intervalMs = 50) {
    this.getWindows = getWindows;
    this.intervalMs = intervalMs;
    this.latest = [];
    this.timer = null;
  }
  update(roster) {
    this.latest = roster;
    if (!this.timer) this.timer = setTimeout(() => this.flush(), this.intervalMs);
  }
  send(window) {
    if (!window || window.isDestroyed() || !window.isVisible() || window.isMinimized()) return;
    window.webContents.send("roster:stats", this.latest);
  }
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const window of this.getWindows()) this.send(window);
  }
}
module.exports = { RosterBroadcaster };
