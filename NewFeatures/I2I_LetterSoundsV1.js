// ===================================================================
//   LetterSounds.js
//   Author: Archeia
//   Version: 1.0.1
// -------------------------------------------------------------------
//
// This plugin enables your messages to play sound effects per letter 
// (or at certain intervals of letters) whenever they appear in a message window. 
// Letter sounds can be used to add emotion, character, and feeling to scenes and 
// provide audio feedback to the activity going on in the screen.
//
// ── Setup ───────────────────────────────────────────────────────────────
//   1. Place short sound files (e.g. .ogg) inside your project's
//      Audio/Sounds/ folder (or a subfolder).
//   2. List filenames (no extension) in config.sounds below.
//   3. Adjust the other defaults to taste, or change them at runtime
//      via  window.LetterSound.<property>
//
// ── Runtime API ─────────────────────────────────────────────────────────
//   window.LetterSound.enabled         = true / false
//   window.LetterSound.sounds          = ["SFX_Penv6","SFX_Penv7","SFX_Penv8"]
//   window.LetterSound.soundFolder     = "Audio/Sounds/Sound Effects/Bleep"
//   window.LetterSound.volume          = 70       (0–100)
//   window.LetterSound.pitch           = 100      (50–200, 100 = normal)
//   window.LetterSound.pitchVariance   = 15       (+/- random range)
//   window.LetterSound.volumeVariance  = 10       (+/- random range)
//   window.LetterSound.interval        = 2        (play every N chars)
//   window.LetterSound.blacklist       = " \n\t"  (chars that don't count)
//   window.LetterSound.muteOnSkip      = true     (silent during skip)
//   window.LetterSound.muteOnInstant   = true     (silent on instant display)
//   window.LetterSound.volumeFloor     = 1        (min vol after variance)
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

(function () {
    if (window.__letterSoundPatched) {
        return;
    }
    window.__letterSoundPatched = true;

    // ── Configuration ──────────────────────────────
    var config = window.LetterSound || {};

    if (config.enabled         == null) config.enabled         = true;
    if (config.sounds          == null) config.sounds          = ["SFX_FastSinglev6", "SFX_FastSinglev7"];
    if (config.soundFolder     == null) config.soundFolder     = "Audio/Sounds/Sound Effects/Bleep";
    if (config.volume          == null) config.volume          = 10;
    if (config.pitch           == null) config.pitch           = 100;
    if (config.pitchVariance   == null) config.pitchVariance   = 15;
    if (config.volumeVariance  == null) config.volumeVariance  = 10;
    if (config.interval        == null) config.interval        = 2;
    if (config.blacklist       == null) config.blacklist       = " \n\t";
    if (config.muteOnSkip      == null) config.muteOnSkip      = true;
    if (config.muteOnInstant   == null) config.muteOnInstant   = true;
    if (config.volumeFloor     == null) config.volumeFloor     = 1;
    if (config.profiles        == null) config.profiles        = {};

    window.LetterSound = config;

    // ── Defaults Snapshot ──────────────────────────────
    var PROFILE_KEYS = [
        "sounds", "soundFolder", "volume", "pitch",
        "pitchVariance", "volumeVariance", "interval",
        "blacklist", "volumeFloor"
    ];

    var _defaults = {};
    for (var d = 0; d < PROFILE_KEYS.length; d++) {
        var dk = PROFILE_KEYS[d];
        _defaults[dk] = Array.isArray(config[dk]) ? config[dk].slice() : config[dk];
    }

    // ── Profiles ───────────────────────────────────────
    config.setProfile = function (name) {
        var j, key, profile;

        // Reset to defaults first, then layer the profile on top.
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
    };

    // ────────────────────────────────────────────────────
    var counter   = 0;
    var lastIndex = -1;
    var preloaded = false;

    function ensurePreloaded() {
        if (preloaded) return;
        preloaded = true;
        var sounds = config.sounds;
        for (var i = 0; i < sounds.length; i++) {
            ResourceManager.getAudioBuffer(config.soundFolder + "/" + sounds[i]);
        }
    }

    function pickSound() {
        var sounds = config.sounds;
        if (sounds.length === 1) return sounds[0];

        var idx;
        do {
            idx = Math.floor(Math.random() * sounds.length);
        } while (idx === lastIndex);
        lastIndex = idx;

        return sounds[idx];
    }

    function clamp(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }

    var _drawNext = Component_MessageTextRenderer.prototype.drawNext;
    Component_MessageTextRenderer.prototype.drawNext = function () {
        var result = _drawNext.call(this);
        if (!config.enabled || !config.sounds || !config.sounds.length)  return result;
        if (config.muteOnSkip    && GameManager.tempSettings.skip)       return result;
        if (config.muteOnInstant && this.drawImmediately)                return result;

        var ch = this.char;
        if (!ch || config.blacklist.indexOf(ch) !== -1) return result;
        counter++;
        if (counter < config.interval) return result;
        counter = 0;

        ensurePreloaded();

        var soundName = pickSound();
        var vol  = config.volume + (Math.random() * 2 - 1) * config.volumeVariance;
        var rate = config.pitch  + (Math.random() * 2 - 1) * config.pitchVariance;

        vol  = clamp(Math.round(vol),  config.volumeFloor, 100);
        rate = clamp(Math.round(rate), 50, 200);

        AudioManager.playSound(
            { name: soundName, folderPath: config.soundFolder },
            vol,
            rate
        );

        return result;
    };
})();
