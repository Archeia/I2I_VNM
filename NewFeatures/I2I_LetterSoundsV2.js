// ===================================================================
//   LetterSounds V2
//   Author: Archeia
//   Version: 2.0.0
// -------------------------------------------------------------------
//
// This plugin enables your messages to play sound effects per letter
// (or at certain intervals of letters) whenever they appear in a message window.
// Letter sounds can be used to add emotion, character, and feeling to scenes and
// provide audio feedback to the activity going on in the screen.
//
// V2 adds per-renderer state, frame-based throttling, lifecycle resets,
// and control-token filtering.
//
// ── Setup ───────────────────────────────────────────────────────────────
//   1. Place short sound files (e.g. .ogg) inside your project's
//      Audio/Sounds/ folder (or a subfolder).
//   2. List filenames (no extension) in config.sounds below.
//   3. Adjust the other defaults to taste, or change them at runtime
//      via  window.LetterSound.<property>
//
// ── Runtime API ─────────────────────────────────────────────────────────
//   window.LetterSound.enabled                = true / false
//   window.LetterSound.sounds                 = ["SFX_Penv6","SFX_Penv7"]
//   window.LetterSound.soundFolder            = "Audio/Sounds/Sound Effects/Bleep"
//   window.LetterSound.volume                 = 10       (0–100)
//   window.LetterSound.pitch                  = 100      (50–200, 100 = normal)
//   window.LetterSound.pitchVariance          = 15       (+/- random range)
//   window.LetterSound.volumeVariance         = 10       (+/- random range)
//   window.LetterSound.interval               = 2        (play every N chars)
//   window.LetterSound.blacklist              = " \n\t"  (chars that don't count)
//   window.LetterSound.muteOnSkip             = true     (silent during skip)
//   window.LetterSound.muteOnInstant          = true     (silent on instant display)
//   window.LetterSound.minFramesBetweenSounds = 1        (frame-based throttle)
//   window.LetterSound.volumeFloor            = 1        (min vol after variance)
//
// ── Character Profiles ──────────────────────────────────────────────────
//   Define named presets and swap with a single call:
//
//   window.LetterSound.profiles = {
//       narrator: { sounds: ["SFX_Typewriter1"], pitch: 90, volume: 15 },
//       hero:     { sounds: ["SFX_Penv6","SFX_Penv7"], pitch: 100 },
//       villain:  { sounds: ["SFX_Dark1"], pitch: 70, volume: 20 }
//   };
//
//   window.LetterSound.setProfile("hero");    // switch voice
//   window.LetterSound.setProfile(null);      // restore defaults
//
// ── In-Game Scene Usage ─────────────────────────────────────────────────
//
//   Use a "Script" command to toggle or configure at runtime:
//
//   Turn off:   window.LetterSound.enabled = false;
//   Turn on:    window.LetterSound.enabled = true;
//
//   Change sounds per character:
//     window.LetterSound.sounds = ["bleep001"];
//     window.LetterSound.pitch  = 80;
//
//   Switch voice profile:
//     window.LetterSound.setProfile("villain");
//
//   Restore defaults:
//     window.LetterSound.setProfile(null);
//
// ===================================================================

(function (root, factory) {
    var api = factory(root);
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {

    // ── Configuration ──────────────────────────────
    var config = (root && root.LetterSound) || {};

    if (config.enabled                == null) config.enabled                = true;
    if (config.sounds                 == null) config.sounds                 = ["SFX_FastSinglev6", "SFX_FastSinglev7"];
    if (config.soundFolder            == null) config.soundFolder            = "Audio/Sounds/Sound Effects/Bleep";
    if (config.volume                 == null) config.volume                 = 10;
    if (config.pitch                  == null) config.pitch                  = 100;
    if (config.pitchVariance          == null) config.pitchVariance          = 15;
    if (config.volumeVariance         == null) config.volumeVariance         = 10;
    if (config.interval               == null) config.interval               = 2;
    if (config.blacklist              == null) config.blacklist              = " \n\t";
    if (config.muteOnSkip             == null) config.muteOnSkip             = true;
    if (config.muteOnInstant          == null) config.muteOnInstant          = true;
    if (config.minFramesBetweenSounds == null) config.minFramesBetweenSounds = 1;
    if (config.volumeFloor            == null) config.volumeFloor            = 1;
    if (config.profiles               == null) config.profiles               = {};

    // ── Defaults Snapshot ──────────────────────────
    var PROFILE_KEYS = [
        "sounds", "soundFolder", "volume", "pitch",
        "pitchVariance", "volumeVariance", "interval",
        "blacklist", "minFramesBetweenSounds", "volumeFloor"
    ];

    var _defaults = {};
    for (var i = 0; i < PROFILE_KEYS.length; i++) {
        var k = PROFILE_KEYS[i];
        _defaults[k] = Array.isArray(config[k]) ? config[k].slice() : config[k];
    }

    // ── Helpers ────────────────────────────────────

    function clamp(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }

    function randomize(base, variation) {
        if (variation <= 0) return base;
        return Math.round(base + (Math.random() * variation * 2) - variation);
    }

    function createBlacklistLookup(str) {
        var i;
        var lookup = {};
        var chars = Array.isArray(str) ? str : String(str || "").split("");
        for (i = 0; i < chars.length; i++) {
            lookup[chars[i]] = true;
        }
        return lookup;
    }

    function isEligibleCharacter(ch, lookup) {
        return ch != null && ch !== "" && !lookup[ch];
    }

    // ── State ──────────────────────────────────────

    function createState() {
        return { eligibleCount: 0, lastPlayFrame: null, lastSoundIndex: -1, suppress: false };
    }

    function stepState(state, ch, frame, cfg) {
        if (!isEligibleCharacter(ch, cfg._blacklistLookup)) return false;

        state.eligibleCount += 1;
        if (state.eligibleCount % cfg.interval !== 0) return false;
        if (state.lastPlayFrame != null &&
            frame - state.lastPlayFrame < cfg.minFramesBetweenSounds) return false;

        state.lastPlayFrame = frame;
        return true;
    }

    function pickSound(state, sounds) {
        if (!sounds || sounds.length === 0) return null;
        if (sounds.length === 1) { state.lastSoundIndex = 0; return sounds[0]; }

        var idx;
        do {
            idx = Math.floor(Math.random() * sounds.length);
        } while (idx === state.lastSoundIndex);
        state.lastSoundIndex = idx;
        return sounds[idx];
    }

    // ── Guard ──────────────────────────────────────

    var api = {
        createState: createState,
        createBlacklistLookup: createBlacklistLookup,
        isEligibleCharacter: isEligibleCharacter,
        stepState: stepState,
        pickSound: pickSound,
        randomize: randomize,
        clamp: clamp
    };

    if (!root || !root.gs || !root.gs.Component_MessageTextRenderer || !root.AudioManager) {
        return api;
    }
    if (root.__letterSoundPatched) {
        return api;
    }
    root.__letterSoundPatched = true;
    root.__mbrTypewriterLetterSoundPatched = true;

    // ── Activate ───────────────────────────────────
    config._blacklistLookup = createBlacklistLookup(config.blacklist);
    config._lastBlacklist   = config.blacklist;
    config._preloadedSounds = null;

    root.LetterSound = config;

    // ── Profiles ───────────────────────────────────

    function applyProfile(name) {
        var j, key, profile;

        // Reset to defaults first, then layer the profile on top.
        // This keeps each switch predictable — no leftover values
        // from a previous character bleed through.
        for (j = 0; j < PROFILE_KEYS.length; j++) {
            key = PROFILE_KEYS[j];
            config[key] = Array.isArray(_defaults[key]) ? _defaults[key].slice() : _defaults[key];
        }

        if (name != null && config.profiles[name]) {
            profile = config.profiles[name];
            for (j = 0; j < PROFILE_KEYS.length; j++) {
                key = PROFILE_KEYS[j];
                if (profile[key] != null) {
                    config[key] = Array.isArray(profile[key]) ? profile[key].slice() : profile[key];
                }
            }
        }
    }

    config.setProfile = applyProfile;

    // ── Per-Renderer State ─────────────────────────

    function getState(renderer) {
        if (!renderer.__letterSoundState) {
            renderer.__letterSoundState = createState();
        }
        return renderer.__letterSoundState;
    }

    function resetState(renderer) {
        var s = getState(renderer);
        s.eligibleCount = 0;
        s.lastPlayFrame = null;
        s.suppress = false;
        return s;
    }

    // ── Sound Playback ─────────────────────────────

    function ensurePreloaded() {
        if (config._preloadedSounds === config.sounds) return;
        config._preloadedSounds = config.sounds;
        if (!root.ResourceManager) return;
        for (var i = 0; i < config.sounds.length; i++) {
            root.ResourceManager.getAudioBuffer(config.soundFolder + "/" + config.sounds[i]);
        }
    }

    function shouldSuppress(renderer) {
        var s = getState(renderer);
        return s.suppress
            || !renderer.isRunning
            || (config.muteOnSkip && root.GameManager &&
                root.GameManager.tempSettings && root.GameManager.tempSettings.skip)
            || (config.muteOnInstant && renderer.drawImmediately);
    }

    function tryPlaySound(renderer, ch) {
        if (!config.enabled || !config.sounds || !config.sounds.length) return;
        if (shouldSuppress(renderer)) return;

        // Rebuild lookup if blacklist was changed at runtime
        if (config._lastBlacklist !== config.blacklist) {
            config._blacklistLookup = createBlacklistLookup(config.blacklist);
            config._lastBlacklist = config.blacklist;
        }

        var state = getState(renderer);
        var frame = root.Graphics && typeof root.Graphics.frameCount === "number"
            ? root.Graphics.frameCount : 0;

        if (!stepState(state, ch, frame, config)) return;

        ensurePreloaded();

        var soundName = pickSound(state, config.sounds);
        if (!soundName) return;

        var vol  = clamp(Math.round(randomize(config.volume, config.volumeVariance)), config.volumeFloor, 100);
        var rate = clamp(Math.round(randomize(config.pitch,  config.pitchVariance)),  50, 200);

        root.AudioManager.playSound({
            name: soundName,
            folderPath: config.soundFolder,
            volume: vol,
            playbackRate: rate
        });
    }

    // ── Patches ────────────────────────────────────
    var Renderer = root.gs.Component_MessageTextRenderer;
    var _drawFormattedText            = Renderer.prototype.drawFormattedText;
    var _drawFormattedTextImmediately = Renderer.prototype.drawFormattedTextImmediately;
    var _clear                        = Renderer.prototype.clear;
    var _drawNext                     = Renderer.prototype.drawNext;

    Renderer.prototype.drawFormattedText = function () {
        resetState(this);
        return _drawFormattedText.apply(this, arguments);
    };

    Renderer.prototype.drawFormattedTextImmediately = function () {
        var s = resetState(this);
        s.suppress = true;
        try {
            return _drawFormattedTextImmediately.apply(this, arguments);
        } finally {
            resetState(this);
        }
    };

    Renderer.prototype.clear = function () {
        resetState(this);
        return _clear.apply(this, arguments);
    };

    Renderer.prototype.drawNext = function () {
        var result = _drawNext.apply(this, arguments);

        if (this.token && !this.token.code && this.char) {
            tryPlaySound(this, this.char);
        }

        return result;
    };

    return api;
});
