/* Shared Halloween audio helper — ambient loop + spin/result stingers.
   Call HalloweenAudio.init(basePath) once, then unlock() inside a user gesture. */
(function (w) {
  'use strict';
  var base = 'assets/sounds/';
  var ambient = null, unlocked = false, muted = false, AMBIENT_VOL = 0.3, SFX_VOL = 0.55;

  function src(name) { return base + name + '.mp3'; }

  function ensureAmbient() {
    if (ambient) return ambient;
    ambient = new Audio(src('ambient-loop'));
    ambient.loop = true;
    ambient.preload = 'auto';
    ambient.volume = muted ? 0 : AMBIENT_VOL;
    return ambient;
  }

  function playShot(name, vol) {
    if (muted || !unlocked) return;
    try {
      var a = new Audio(src(name));
      a.preload = 'auto';
      a.volume = vol == null ? SFX_VOL : vol;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  var API = {
    init: function (path, initiallyMuted) {
      if (path) base = path.replace(/\/?$/, '/');
      muted = !!initiallyMuted;
      return API;
    },
    unlock: function () {
      if (unlocked) {
        // Re-nudge ambient if it stalled after unlock
        if (!muted && ambient && ambient.paused) {
          var p = ambient.play();
          if (p && p.catch) p.catch(function () {});
        }
        return;
      }
      unlocked = true;
      ensureAmbient();
      if (!muted) {
        var p = ambient.play();
        if (p && p.catch) p.catch(function () {});
      }
      // Warm SFX buffers inside the same gesture (iOS)
      try {
        ['spin-creak', 'result-sting'].forEach(function (n) {
          var w = new Audio(src(n));
          w.preload = 'auto';
          w.volume = 0;
          var q = w.play();
          if (q && q.then) q.then(function () { w.pause(); w.currentTime = 0; }).catch(function () {});
        });
      } catch (e) {}
    },
    setMuted: function (m) {
      muted = !!m;
      if (!ambient) return;
      ambient.volume = muted ? 0 : AMBIENT_VOL;
      if (muted) {
        try { ambient.pause(); } catch (e) {}
      } else if (unlocked) {
        var p = ambient.play();
        if (p && p.catch) p.catch(function () {});
      }
    },
    isMuted: function () { return muted; },
    isUnlocked: function () { return unlocked; },
    playCreak: function () { playShot('spin-creak', 0.6); },
    playSting: function () { playShot('result-sting', 0.55); }
  };

  w.HalloweenAudio = API;
})(window);
