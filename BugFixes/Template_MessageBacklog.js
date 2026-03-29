// ===================================================================
//   Template_MessageBacklog
//   Author: Archeia
//   Version: 2.0.0
// -------------------------------------------------------------------
//
// Replaces the engine's built-in default backlog.
//
// ── Fixes over original ────────────────────────────────────────────
//   - Proper word-wrap with dynamic-height entries (no overlap)
//   - Mouse-wheel scroll-up gesture to open backlog
//   - Escape key / overlay click / Back button to close
//   - Draggable scrollbar with bidirectional sync
//   - Consecutive same-speaker line merging
//
// ===================================================================

ui.UiFactory.customTypes["ui.MessageBacklog"] = {
    "type": "ui.FreeLayout",
    "frame": [0, 0, 1, 1]
};
ui.UiFactory.customTypes["ui.MessageBacklogBox"] = {
    "type": "ui.FreeLayout",
    "frame": [0, 0, 1, 1]
};

// ── Configuration ─────────────────────────────────────────────────────

window.BacklogConfig = {
    // ── Mouse ──
    mouseWheelOpen: true,          // open backlog by scrolling up
    mouseWheelThreshold: 3,        // number of scroll-up ticks needed

    // ── Panels ──
    // Overlay / background (full screen, click to dismiss)
    overlayStyle: "backlogMessagePanel",  // engine skin style, or null for flat color
    overlayColor: [0, 0, 0, 178],        // flat color fallback (used when overlayStyle is null)

    // Content box (centered area — only shown when overlayStyle is null)
    contentColor: [15, 15, 30, 200],

    // Name column panel (left side — set to null to disable)
    namePanelStyle: "backlogNamePanel",

    // ── Text ──
    // Name text — set to null to use nameFont instead
    nameTextStyles: ["backlogNameText"],
    nameFont: { name: "yumin", size: 26, border: true, borderSize: 4 },

    // Message text — set to null to use msgFont instead
    msgTextStyles: ["messageText"],
    msgFont: { name: "yumin", size: 26 },

    // ── Animations ──
    animate: true,                 // fade in/out panels on open/close
    animationType: 1,              // VNM animation type id
    animationDuration: 30,         // duration in frames

    // ── Scrollbar ──
    scrollTrackColor: [255, 255, 255, 30],
    scrollThumbColor: [255, 255, 255, 120],

    // ── Button ──
    buttonText: "Back"
};

// ── Text extraction helpers ───────────────────────────────────────────

function _blExtractText(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    if (obj.defaultText) return obj.defaultText;
    if (obj.text) return _blExtractText(obj.text);
    if (obj.value) return obj.value;
    return String(obj);
}

function _blExtractName(entry) {
    if (!entry || !entry.character) return "";
    var n = entry.character.name;
    if (!n) return "";
    if (typeof n === "string") return n;
    return n.defaultText || n.text || n.value || "";
}

// ── Merge consecutive lines from the same character into one entry ────

function _blMergeEntries(data) {
    if (!data || !data.length) return [];

    var merged = [];
    var current = null;

    for (var i = 0; i < data.length; i++) {
        var entry = data[i];

        if (entry.isChoice) {
            if (current) { merged.push(current); current = null; }
            merged.push({
                isChoice: true,
                choice: entry.choice,
                character: entry.character,
                _text: "",
                _name: ""
            });
            continue;
        }

        var charId = null;
        if (entry.character) {
            charId = entry.character.index != null ? entry.character.index
                   : entry.character.id != null   ? entry.character.id
                   : null;
        }

        var prevId = null;
        if (current && current.character) {
            prevId = current.character.index != null ? current.character.index
                   : current.character.id != null   ? current.character.id
                   : null;
        }

        if (current && charId === prevId && charId !== null) {
            var msg = _blExtractText(entry.message);
            if (msg.trim()) {
                current._text += "\n" + msg;
            }
        } else {
            if (current) merged.push(current);
            current = {
                character: entry.character,
                isChoice: false,
                _text: _blExtractText(entry.message),
                _name: _blExtractName(entry)
            };
        }
    }

    if (current) merged.push(current);
    return merged;
}

// ── Layout constants ──────────────────────────────────────────────────

var BL_W         = Graphics.width;
var BL_H         = Graphics.height;
var BL_CONTENT_W = Math.floor(BL_W * 0.85);
var BL_CONTENT_H = Math.floor(BL_H * 0.88);
var BL_CONTENT_X = Math.floor((BL_W - BL_CONTENT_W) / 2);
var BL_CONTENT_Y = Math.floor((BL_H - BL_CONTENT_H) / 2);
var BL_PAD       = 20;
var BL_INNER_W   = BL_CONTENT_W - BL_PAD * 2;
var BL_NAME_W    = Math.floor(BL_INNER_W * 0.20);
var BL_COL_GAP   = 20;
var BL_MSG_X     = BL_NAME_W + BL_COL_GAP;
var BL_MSG_W     = BL_INNER_W - BL_MSG_X - 40;
var BL_SCROLL_H  = BL_CONTENT_H - BL_PAD * 2 - 60;

// ──────────────────────────────────────────────────────────────────────

function _blMsgEntry(entry) {
    var cfg = window.BacklogConfig;
    var nameColor = [255, 255, 255, 255];
    if (entry.character && entry.character.textColor) {
        var tc = entry.character.textColor;
        nameColor = [tc.red || 255, tc.green || 255, tc.blue || 255, 255];
    }

    // Name text — engine styles or inline font
    var nameCtrl = {
        type: "ui.Text",
        frame: [0, 0],
        margin: [0, 0, 10, 0],
        sizeToFit: true,
        alignmentX: "right",
        zIndex: 1,
        text: entry._name || ""
    };
    if (cfg.nameTextStyles) {
        nameCtrl.styles = cfg.nameTextStyles;
        nameCtrl.font = { color: nameColor };
    } else {
        var nf = cfg.nameFont || { name: "yumin", size: 26 };
        nameCtrl.font = {
            name: nf.name, size: nf.size,
            color: nameColor,
            border: nf.border || false, borderSize: nf.borderSize || 0
        };
    }

    // Message text — engine styles or inline font
    var msgCtrl = {
        type: "ui.Text",
        frame: [BL_MSG_X, 0, BL_MSG_W, 0],
        margin: [0, 4, 0, 4],
        sizeToFit: { horizontal: false, vertical: true },
        formatting: true,
        wordWrap: true,
        zIndex: 1,
        text: entry._text || ""
    };
    if (cfg.msgTextStyles) {
        msgCtrl.styles = cfg.msgTextStyles;
    } else {
        msgCtrl.font = cfg.msgFont || { name: "yumin", size: 26 };
    }

    return {
        type: "ui.FreeLayout",
        sizeToFit: true,
        frame: [0, 0, BL_INNER_W, 1],
        margin: [0, 0, 0, 30],
        controls: [
            {
                type: "ui.FreeLayout",
                frame: [0, 2, BL_NAME_W, 30],
                controls: [nameCtrl]
            },
            msgCtrl
        ]
    };
}

function _blChoiceEntry(entry) {
    var choiceText = "";
    if (entry.choice) {
        choiceText = _blExtractText(entry.choice.text || entry.choice);
    }

    return {
        type: "ui.FreeLayout",
        sizeToFit: true,
        frame: [0, 0, BL_INNER_W, 50],
        margin: [0, 0, 0, 30],
        controls: [
            {
                type: "ui.Image",
                frame: [BL_MSG_X, 0],
                image: "In-Game-UI/Choice_Idle",
                alignmentX: "center",
                zIndex: 1
            },
            {
                type: "ui.Text",
                sizeToFit: true,
                formatting: true,
                wordWrap: false,
                styles: ["choiceUIText"],
                alignmentX: 1,
                alignmentY: 1,
                frame: [BL_MSG_X, 0],
                margin: [0, -5, 0, 0],
                text: choiceText,
                zIndex: 2
            }
        ]
    };
}

// ── Build full backlog overlay descriptor ─────────────────────────────

function _blBuild() {
    var backlogData = (window.$dataFields && window.$dataFields.backlog)
        ? window.$dataFields.backlog
        : [];

    var merged = _blMergeEntries(backlogData);
    var entries = [];
    for (var i = 0; i < merged.length; i++) {
        entries.push(merged[i].isChoice
            ? _blChoiceEntry(merged[i])
            : _blMsgEntry(merged[i]));
    }

    var cfg = window.BacklogConfig;
    var controls = [];

    // Animation descriptors (reused by panels)
    var anim = null;
    if (cfg.animate) {
        anim = [
            { event: "onInitialize", flow: [{ type: "appear", animation: { type: cfg.animationType }, duration: cfg.animationDuration, wait: true }] },
            { event: "onTerminate", flow: [{ type: "disappear", animation: { type: cfg.animationType }, duration: cfg.animationDuration, wait: true }] }
        ];
    }

    // 1. Overlay / background (full screen, modal, click to dismiss)
    var overlayPanel = {
        type: "ui.Panel", modal: true, zIndex: 1,
        frame: [0, 0, BL_W, BL_H],
        action: { event: "onCancel", name: "disposeControl", params: "backlogOverlay" }
    };
    if (cfg.overlayStyle) {
        overlayPanel.style = cfg.overlayStyle;
    } else {
        overlayPanel.color = cfg.overlayColor;
    }
    if (anim) overlayPanel.animations2 = anim;
    controls.push(overlayPanel);

    // 2. Name column panel
    if (cfg.namePanelStyle) {
        var namePanel = {
            type: "ui.Panel", zIndex: 2,
            style: cfg.namePanelStyle,
            frame: [0, 0, Math.floor(BL_W * 0.25), BL_H]
        };
        if (anim) namePanel.animations2 = anim;
        controls.push(namePanel);
    }

    // 3. Content box
    if (!cfg.overlayStyle && cfg.contentColor) {
        controls.push({
            type: "ui.Panel", zIndex: 2,
            frame: [BL_CONTENT_X, BL_CONTENT_Y, BL_CONTENT_W, BL_CONTENT_H],
            color: cfg.contentColor
        });
    }

    // 4. Scrollable area + scrollbar
    controls.push({
        type: "ui.FreeLayout",
        id: "backlogClip",
        zIndex: 3,
        frame: [BL_CONTENT_X + BL_PAD, BL_CONTENT_Y + BL_PAD, BL_INNER_W, BL_SCROLL_H],
        controls: [
            {
                type: "ui.Panel",
                id: "backlogSBTrack",
                frame: [BL_INNER_W - 10, 0, 6, BL_SCROLL_H],
                color: cfg.scrollTrackColor,
                zIndex: 10
            },
            {
                type: "ui.Panel",
                id: "backlogSBThumb",
                frame: [BL_INNER_W - 10, 0, 6, 50],
                color: cfg.scrollThumbColor,
                zIndex: 11,
                draggable: {
                    rect: [BL_INNER_W - 30, 0, 40, BL_SCROLL_H],
                    axisX: false, axisY: true
                }
            },
            {
                type: "ui.StackLayout",
                id: "backlogStack",
                clipRect: true,
                frame: [0, 0, BL_INNER_W - 20, BL_SCROLL_H],
                orientation: "vertical",
                scrollable: true,
                controls: entries
            }
        ]
    });

    // 5. Back button
    controls.push({
        type: "ui.Button",
        params: {
            text: { defaultText: cfg.buttonText },
            action: { name: "disposeControl", params: "backlogOverlay" }
        },
        frame: [BL_CONTENT_X + BL_CONTENT_W - 170, BL_CONTENT_Y + BL_CONTENT_H - 65, 150, 45],
        zIndex: 10
    });

    return {
        type: "ui.FreeLayout",
        id: "backlogOverlay",
        zIndex: 80000,
        order: 80000,
        frame: [0, 0, BL_W, BL_H],
        controls: controls
    };
}

function _blApplyClipRect(obj, rect) {
    if (!obj) return;
    obj.clipRect = rect;
    if (obj.subObjects) {
        for (var i = 0; i < obj.subObjects.length; i++) {
            _blApplyClipRect(obj.subObjects[i], rect);
        }
    }
    if (obj.controls) {
        for (var i = 0; i < obj.controls.length; i++) {
            _blApplyClipRect(obj.controls[i], rect);
        }
    }
}

function _blApplyClipToChildren(stack, rect) {
    if (!stack) return;
    var subs = stack.subObjects || [];
    for (var i = 0; i < subs.length; i++) {
        _blApplyClipRect(subs[i], rect);
    }
    var ctrls = stack.controls || [];
    for (var i = 0; i < ctrls.length; i++) {
        _blApplyClipRect(ctrls[i], rect);
    }
}

function _blSyncScrollbar() {
    if (!window._backlogOpen) {
        clearInterval(window._blSync);
        window._blSync = null;
        return;
    }

    var clip  = gs.ObjectManager.current.objectById("backlogClip");
    var stack = gs.ObjectManager.current.objectById("backlogStack");
    if (!clip || !stack) {
        clearInterval(window._blSync);
        window._blSync = null;
        return;
    }

    _blApplyClipToChildren(stack, new gs.Rect(
        clip.dstRect.x, clip.dstRect.y,
        clip.dstRect.width, clip.dstRect.height
    ));

    var track = gs.ObjectManager.current.objectById("backlogSBTrack");
    var thumb = gs.ObjectManager.current.objectById("backlogSBThumb");
    if (!thumb || !track) return;

    if (stack.scrollableHeight <= 0) {
        track.visible = false;
        thumb.visible = false;
        return;
    }

    track.visible = true;
    thumb.visible = true;

    var thumbH = Math.max(30, BL_SCROLL_H / (stack.contentHeight || 1) * BL_SCROLL_H);
    thumb.dstRect.height = thumbH;
    var maxThumbY = BL_SCROLL_H - thumbH;


    if (window._blLastThumbY !== undefined &&
        Math.abs(thumb.dstRect.y - window._blLastThumbY) > 0.5) {
        stack.scrollOffsetY = maxThumbY > 0
            ? (thumb.dstRect.y / maxThumbY * stack.scrollableHeight)
            : 0;
        stack.scrollOffsetY = Math.max(0, Math.min(stack.scrollOffsetY, stack.scrollableHeight));
        window._blLastScrollY = stack.scrollOffsetY;
    }

    else if (stack.scrollOffsetY !== window._blLastScrollY) {
        thumb.dstRect.y = stack.scrollableHeight > 0
            ? (stack.scrollOffsetY / stack.scrollableHeight * maxThumbY)
            : 0;
        window._blLastScrollY = stack.scrollOffsetY;
    }

    window._blLastThumbY = thumb.dstRect.y;
}

// ── Public API ────────────────────────────────────────────────────────

window.openBacklog = function() {
    var scene = SceneManager.scene;
    if (!scene || !scene.behavior || window._backlogOpen) return;

    window._backlogOpen = true;
    window._blLastScrollY = undefined;
    window._blLastThumbY = undefined;

    scene.behavior.createControl(scene.behavior.object, { descriptor: _blBuild() });


    setTimeout(function() {
        var clip  = gs.ObjectManager.current.objectById("backlogClip");
        var stack = gs.ObjectManager.current.objectById("backlogStack");
        if (clip && stack) {
            var r = new gs.Rect(
                clip.dstRect.x, clip.dstRect.y,
                clip.dstRect.width, clip.dstRect.height
            );
            _blApplyClipToChildren(stack, r);
            stack.scrollOffsetY = Math.max(0, (stack.contentHeight || 0) - stack.dstRect.height);
        }

        var bl = gs.ObjectManager.current.objectById("backlogOverlay");
        if (bl) {
            var originalDispose = bl.dispose.bind(bl);
            bl.dispose = function() {
                window._backlogOpen = false;
                if (window._blSync) {
                    clearInterval(window._blSync);
                    window._blSync = null;
                }
                originalDispose();
            };
        }
    }, 100);

    setTimeout(function() {
        var stack = gs.ObjectManager.current.objectById("backlogStack");
        if (stack) {
            stack.scrollOffsetY = Math.max(0, (stack.contentHeight || 0) - stack.dstRect.height);
        }
    }, 400);

    // Start scrollbar sync at ~60fps
    window._blSync = setInterval(_blSyncScrollbar, 16);
};

window.closeBacklog = function() {
    if (!window._backlogOpen) return;
    if (window._blSync) {
        clearInterval(window._blSync);
        window._blSync = null;
    }
    var ctrl = gs.ObjectManager.current.objectById("backlogOverlay");
    if (ctrl) ctrl.dispose();
    window._backlogOpen = false;
};

// ── Engine integration ─────────

(function() {
    if (window.showI2IBacklog) {
        window._originalShowI2IBacklog = window.showI2IBacklog;
        window.showI2IBacklog = function() {
            window.openBacklog();
        };
    }
})();

(function() {
    Component_CommandInterpreter.prototype.commandBacklogVisibility = function() {
        if (this.params.visible) {
            var existing = gs.ObjectManager.current.objectById("backlogBox")
                        || gs.ObjectManager.current.objectById("backlog")
                        || gs.ObjectManager.current.objectById("backlogScrollView");
            if (existing) existing.dispose();
            window.openBacklog();
        } else {
            window.closeBacklog();
        }
    };
})();

// ── Mouse wheel — open backlog ───────────────────

(function() {
    var count = 0;
    var timer = null;

    window.addEventListener('wheel', function(e) {
        if (!window.BacklogConfig.mouseWheelOpen) return;
        if (window._backlogOpen) return;

        if (e.deltaY >= 0) { count = 0; return; }

        var scene = SceneManager.scene;
        if (!scene || !scene.interpreter) return;

        count++;
        clearTimeout(timer);
        timer = setTimeout(function() { count = 0; }, 500);

        if (count >= window.BacklogConfig.mouseWheelThreshold) {
            count = 0;
            window.openBacklog();
        }
    }, { passive: true });
})();

// ── Escape key closes the backlog ─────────────────────────────────────

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && window._backlogOpen) {
        window.closeBacklog();
    }
});
