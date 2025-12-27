// ===================================================================
//
//   Script: I2I Cursor Fix
//   Author: Iris to Id
//   Version: 1.0.0
//
// ===================================================================
//
//   Depending on the project, sometimes your custom cursor will not
//   display when loading a save file. This plugin fixes that.
//
// ===================================================================

(function() {
    'use strict';

    // ============================================================
    // DEFAULT CURSOR CONFIGURATION
    // Set this to your custom cursor - it will be applied automatically
    // ============================================================
    const DEFAULT_CURSOR = {
        name: "YourCustomCursor.png",
        folderPath: "Graphics/Pictures/",
        hx: 0,  // hotspot X
        hy: 0   // hotspot Y
    };
    // Set to null to disable automatic cursor: const DEFAULT_CURSOR = null;
    // Storage for custom cursor state
    window._customCursorState = {
        isCustom: false,      // Whether a custom cursor is active
        bitmap: null,         // The bitmap object
        hx: 0,                // Hotspot X
        hy: 0,                // Hotspot Y
        graphic: null,        // The graphic params (for reloading if needed)
        path: null            // The resource path for reloading bitmap
    };

    let _internalCall = false;

    function ensureBitmapValid() {
        const state = window._customCursorState;
        if (!state.isCustom) return null;
        if (state.bitmap && state.bitmap.image && state.bitmap.image.src) {
            return state.bitmap;
        }

        if (state.path && typeof ResourceManager !== 'undefined') {
            try {
                state.bitmap = ResourceManager.getBitmap(state.path);
                return state.bitmap;
            } catch (e) {
            }
        }

        if (state.graphic && state.graphic.name && typeof ResourceManager !== 'undefined') {
            try {
                const folderPath = state.graphic.folderPath || "Graphics/Pictures";
                const path = folderPath + "/" + state.graphic.name;
                state.path = path;
                state.bitmap = ResourceManager.getBitmap(path);
                return state.bitmap;
            } catch (e) {
            }
        }

        return null;
    }

    function restoreCustomCursor() {
        if (!window._customCursorState.isCustom) return false;

        try {
            const bitmap = ensureBitmapValid();
            if (bitmap && typeof Graphics !== 'undefined' && Graphics.setCursorBitmap) {
                _internalCall = true;
                Graphics.setCursorBitmap(
                    bitmap,
                    window._customCursorState.hx,
                    window._customCursorState.hy
                );
                _internalCall = false;
                return true;
            }
        } catch (e) {
            _internalCall = false;
        }
        return false;
    }

    function applyPatch() {
        if (typeof Graphics === 'undefined' || typeof GameManager === 'undefined') {
            return false;
        }
        if (Graphics._cursorPreservePatchApplied) {
            return true;
        }
        Graphics._cursorPreservePatchApplied = true;
        if (typeof gs !== 'undefined' && gs.Component_CommandInterpreter) {
            const InterpreterProto = gs.Component_CommandInterpreter.prototype;
            const _originalCommandChangeScreenCursor = InterpreterProto.commandChangeScreenCursor;

            InterpreterProto.commandChangeScreenCursor = function() {
                const graphic = this.params ? this.params.graphic : null;

                if (graphic && graphic.name) {
                    const folderPath = graphic.folderPath || "Graphics/Pictures";
                    const cursorPath = folderPath + "/" + graphic.name;
                    window._customCursorState.graphic = graphic;
                    window._customCursorState.hx = this.params.hx || 0;
                    window._customCursorState.hy = this.params.hy || 0;
                    window._customCursorState.path = cursorPath;
                    window._customCursorState.isCustom = true;
                } else {
                    window._customCursorState.isCustom = false;
                    window._customCursorState.graphic = null;
                    window._customCursorState.path = null;
                    window._customCursorState.bitmap = null;
                }

                const result = _originalCommandChangeScreenCursor.call(this);
                if (window._customCursorState.isCustom && window._customCursorState.path) {
                    try {
                        window._customCursorState.bitmap = ResourceManager.getBitmap(window._customCursorState.path);
                    } catch (e) {
                    }
                }

                return result;
            };
        }

        // ============================================================
        // Hook GameManager.setupCursor to restore custom cursor
        // ============================================================
        const _originalSetupCursor = GameManager.setupCursor;
        GameManager.setupCursor = function() {
            if (window._customCursorState.isCustom) {
                if (restoreCustomCursor()) {
                    return;
                }
                window._customCursorState.isCustom = false;
            }
            _internalCall = true;
            const result = _originalSetupCursor.call(this);
            _internalCall = false;
            return result;
        };

        // ============================================================
        // Hook SceneManager.returnToPrevious to restore cursor on menu close
        // ============================================================
        if (typeof SceneManager !== 'undefined' && SceneManager.returnToPrevious) {
            const _originalReturnToPrevious = SceneManager.returnToPrevious;
            SceneManager.returnToPrevious = function(callback) {
                const result = _originalReturnToPrevious.call(this, callback);

                // Schedule cursor restore after scene transition completes
                if (window._customCursorState.isCustom) {
                    setTimeout(function() {
                        if (window._customCursorState.isCustom) {
                            restoreCustomCursor();
                        }
                    }, 150);
                }

                return result;
            };
        }

        // ============================================================
        // Watch for scene stack changes to catch menu close
        // ============================================================
        let lastSceneCount = 0;
        let restorePending = false;
        const _originalSceneManagerUpdate = SceneManager.update;
        SceneManager.update = function() {
            const result = _originalSceneManagerUpdate.call(this);

            // Detect when returning from a menu (previousScenes count decreased)
            const currentSceneCount = this.previousScenes ? this.previousScenes.length : 0;
            if (currentSceneCount < lastSceneCount && !restorePending) {
                if (window._customCursorState.isCustom) {
                    restorePending = true;
                    requestAnimationFrame(function() {
                        restorePending = false;
                        if (window._customCursorState.isCustom) {
                            restoreCustomCursor();
                        }
                    });
                }
            }
            lastSceneCount = currentSceneCount;

            return result;
        };

        // ============================================================
        // Hook prepareSaveGame to save cursor state
        // ============================================================
        const _originalPrepareSaveGame = GameManager.prepareSaveGame;
        GameManager.prepareSaveGame = function(snapshot) {
            const result = _originalPrepareSaveGame.call(this, snapshot);
            if (this.saveGame && this.saveGame.data && window._customCursorState.isCustom) {
                this.saveGame.customCursorState = {
                    isCustom: window._customCursorState.isCustom,
                    graphic: window._customCursorState.graphic,
                    hx: window._customCursorState.hx,
                    hy: window._customCursorState.hy,
                    path: window._customCursorState.path
                };
            }

            return result;
        };

        // ============================================================
        // Hook restore to load cursor state
        // ============================================================
        const _originalRestore = GameManager.restore;
        GameManager.restore = function(saveGame) {
            const result = _originalRestore.call(this, saveGame);
            if (saveGame && saveGame.customCursorState && saveGame.customCursorState.isCustom) {
                window._customCursorState.isCustom = true;
                window._customCursorState.graphic = saveGame.customCursorState.graphic;
                window._customCursorState.hx = saveGame.customCursorState.hx || 0;
                window._customCursorState.hy = saveGame.customCursorState.hy || 0;
                window._customCursorState.path = saveGame.customCursorState.path;
                window._customCursorState.bitmap = null; // Will be reloaded

                setTimeout(function() {
                    restoreCustomCursor();
                }, 500);
            }

            return result;
        };
        if (DEFAULT_CURSOR && DEFAULT_CURSOR.name && !window._customCursorState.isCustom) {
            try {
                const folderPath = DEFAULT_CURSOR.folderPath || "Graphics/Pictures";
                const cursorPath = folderPath + "/" + DEFAULT_CURSOR.name;

                window._customCursorState.graphic = {
                    name: DEFAULT_CURSOR.name,
                    folderPath: folderPath
                };
                window._customCursorState.hx = DEFAULT_CURSOR.hx || 0;
                window._customCursorState.hy = DEFAULT_CURSOR.hy || 0;
                window._customCursorState.path = cursorPath;
                window._customCursorState.isCustom = true;

                const bitmap = ResourceManager.getBitmap(cursorPath);
                window._customCursorState.bitmap = bitmap;

                Graphics.setCursorBitmap(bitmap, DEFAULT_CURSOR.hx || 0, DEFAULT_CURSOR.hy || 0);
            } catch (e) {
            }
        }

        return true;
    }

    window.CursorPreservePatch = {
        setCustomCursor: function(graphic, hx, hy) {
            if (!graphic || !graphic.name) {
                this.clearCustomCursor();
                return;
            }

            try {
                const path = ResourceManager.getPath(graphic);
                const bitmap = ResourceManager.getBitmap(path);
                window._customCursorState.isCustom = true;
                window._customCursorState.bitmap = bitmap;
                window._customCursorState.hx = hx || 0;
                window._customCursorState.hy = hy || 0;
                window._customCursorState.graphic = graphic;
                window._customCursorState.path = path;

                _internalCall = true;
                Graphics.setCursorBitmap(bitmap, hx || 0, hy || 0);
                _internalCall = false;
            } catch (e) {
                _internalCall = false;
            }
        },

        clearCustomCursor: function() {
            window._customCursorState.isCustom = false;
            window._customCursorState.bitmap = null;
            window._customCursorState.graphic = null;
            window._customCursorState.path = null;
            if (typeof GameManager !== 'undefined' && GameManager.setupCursor) {
                GameManager.setupCursor();
            }
        },

        forceRestore: function() {
            return restoreCustomCursor();
        },

        isCustomCursorActive: function() {
            return window._customCursorState.isCustom;
        },

        getState: function() {
            return Object.assign({}, window._customCursorState);
        }
    };

    if (!applyPatch()) {
        const patchWatcher = setInterval(function() {
            if (applyPatch()) {
                clearInterval(patchWatcher);
            }
        }, 100);

        // Give up after 30 seconds
        setTimeout(function() {
            clearInterval(patchWatcher);
        }, 30000);
    }
})();
