// ===================================================================
//
//   Script: Text Input Plugin for Visual Novel Maker
//   Version: 5.0.0
//   Author: Iris to Id (https://iristoid.itch.io/)
//   
// ===================================================================
//
// DESCRIPTION:
//   A customizable text input dialog for Visual Novel Maker that allows
//   players to enter text (names, responses, etc.) which gets stored in
//   a game variable. Built with pure HTML/CSS.
//
// USAGE:
//   showTextInput(variableId, message, maxLength, confirmLabel, cancelLabel, allowedChars)
//
// PARAMETERS:
//   variableId   - The string variable ID to store the input (1-based)
//   message      - The prompt message to display
//   maxLength    - Maximum characters allowed (default: 20)
//   confirmLabel - Label to jump to on confirm (optional)
//   cancelLabel  - Label to jump to on cancel (optional)
//   allowedChars - Character filter pattern (optional, e.g., "a-zA-Z0-9")
//
// EXAMPLES:
//   showTextInput(1, "What is your name?", 20);
//   showTextInput(1, "Enter age:", 3, null, null, "0-9");
//   showTextInput(2, "Enter code:", 10, "success", "failed", "A-Z0-9");
//   showTextInput(15, "What is your name?", 20, "afterNameInput", "nameCanceled"); 
// ===================================================================

// CONFIGURATION
window.TextInputConfig = {
    // Position: 
    // "center", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"
    position: "center",
    customX: null,
    customY: null,

    // Size
    width: 600,
    padding: 30,

    // Background (leave empty to use VNM skin)
    backgroundImage: "",
    backgroundColor: "",
    overlayColor: "rgba(0,0,0,0.5)",

    // VNM Integration
    useVNMSkin: true,
    useVNMCursor: true,

    // Fonts
    fontFamily: '"Times New Roman", serif',
    fontSize: 28,
    fontColor: "#ffffff",
    outlineColor: "#000000",
    outlineWidth: 2,

    // Input Field
    inputBackgroundColor: "#ffffff",
    inputTextColor: "#000000",
    inputFontSize: 28,
    inputPlaceholder: "Enter name...",

    // Buttons
    showButtons: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    buttonFontSize: 22,
    buttonTextColor: "#ffffff",
    buttonBackgroundColor: "",
    buttonBackgroundImage: "",

    // Instructions
    showInstructions: true,
    instructionsText: "Press ENTER to confirm, ESC to cancel",
    instructionsFontSize: 22
};

class TextInputDialog {
    constructor(variableId, message, maxLength, confirmLabel, cancelLabel, allowedChars) {
        this.config = window.TextInputConfig;
        this.variableId = variableId || 1;
        this.message = message || "Please enter a name:";
        this.maxLength = maxLength || 20;
        this.confirmLabel = confirmLabel || null;
        this.cancelLabel = cancelLabel || null;
        this.allowedChars = allowedChars || null;
        this.allowedCharsRegex = this.parseAllowedChars(this.allowedChars);
        this.inputText = "";
        this.overlay = null;
        this.dialog = null;
        this.input = null;
        this.styleElement = null;
    }

    parseAllowedChars(pattern) {
        if (!pattern) return null;

        let regexStr = '';
        let i = 0;

        while (i < pattern.length) {
            const char = pattern[i];
            const nextChar = pattern[i + 1];
            const nextNextChar = pattern[i + 2];

            if (nextChar === '-' && nextNextChar !== undefined) {
                regexStr += char + '-' + nextNextChar;
                i += 3;
            } else {
                if ('-[]\\^$.|?*+(){}'.includes(char)) {
                    regexStr += '\\' + char;
                } else {
                    regexStr += char;
                }
                i++;
            }
        }

        try {
            return new RegExp('^[' + regexStr + ']*$');
        } catch (e) {
            return null;
        }
    }

    isAllowedText(text) {
        if (!this.allowedCharsRegex) return true;
        return this.allowedCharsRegex.test(text);
    }

    playConfirmSound() {
        const sounds = RecordManager?.system?.sounds;
        if (sounds && sounds[1]) {
            AudioManager.playSound(sounds[1]);
        }
    }

    playCancelSound() {
        const sounds = RecordManager?.system?.sounds;
        if (sounds && sounds[2]) {
            AudioManager.playSound(sounds[2]);
        }
    }

    playSelectSound() {
        const sounds = RecordManager?.system?.sounds;
        if (sounds && sounds[0]) {
            AudioManager.playSound(sounds[0]);
        }
    }

    show() {
        window._activeTextInputDialog = this;
        this.createHTML();
        this.setupEventListeners();
        setTimeout(() => this.input.focus(), 50);
    }

    getTextShadow(color, width) {
        if (!color || width <= 0) return 'none';
        const w = width;
        return `
            ${w}px ${w}px 0 ${color},
            -${w}px -${w}px 0 ${color},
            ${w}px -${w}px 0 ${color},
            -${w}px ${w}px 0 ${color}
        `;
    }

    getPositionCSS() {
        const cfg = this.config;

        if (cfg.customX !== null || cfg.customY !== null) {
            const x = cfg.customX !== null ? cfg.customX : 0;
            const y = cfg.customY !== null ? cfg.customY : 0;
            return `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
            `;
        }

        const positions = {
            "center": "margin: auto;",
            "top": "margin: 50px auto auto auto;",
            "bottom": "margin: auto auto 50px auto;",
            "top-left": "margin: 50px auto auto 50px;",
            "top-right": "margin: 50px 50px auto auto;",
            "bottom-left": "margin: auto auto 50px 50px;",
            "bottom-right": "margin: auto 50px 50px auto;"
        };

        return positions[cfg.position] || positions["center"];
    }

    getVNMSkinImages() {
        if (!this.config.useVNMSkin) return { tile: "", stretch: "", frame: "" };

        const getStyleImage = (styleName) => {
            if (!window._vnmSkinCache) window._vnmSkinCache = {};
            if (window._vnmSkinCache[styleName]) return window._vnmSkinCache[styleName];

            const style = ui?.UIManager?.styles?.[styleName];
            if (!style) return "";

            const imageName = style.image || style.descriptor?.image;
            if (!imageName) return "";

            let imageFolder = style.descriptor?.imageFolder;
            if (!imageFolder || imageFolder === "Graphics/Pictures") {
                imageFolder = "Graphics/Pictures/";
            }

            const bitmap = ResourceManager.getBitmap(imageFolder + "/" + imageName);
            const url = bitmap?.image?.src || "";

            if (url) window._vnmSkinCache[styleName] = url;

            return url;
        };

        return {
            tile: getStyleImage("windowTilePattern"),
            stretch: getStyleImage("windowStretchPattern"),
            frame: getStyleImage("windowFrame")
        };
    }

    getCursorStyle() {
        if (!this.config.useVNMCursor) return 'auto';

        const sysCursor = RecordManager?.system?.cursor;
        if (!sysCursor?.name) return 'auto';

        if (!window._vnmCursorCache) {
            const cursorPath = ResourceManager.getPath(sysCursor);
            const bitmap = ResourceManager.getBitmap(cursorPath);
            let cursorUrl = bitmap?.image?.src || "";
            if (!cursorUrl) {
                cursorUrl = "resources/" + cursorPath + (cursorPath.endsWith('.png') ? '' : '.png');
            }
            window._vnmCursorCache = {
                url: cursorUrl,
                hx: sysCursor.hx || 0,
                hy: sysCursor.hy || 0
            };
        }

        if (window._vnmCursorCache?.url) {
            const { url, hx, hy } = window._vnmCursorCache;
            return `url('${url}') ${hx} ${hy}, auto`;
        }
        return 'auto';
    }

    getCustomBackgroundUrl(imagePath) {
        if (!imagePath) return null;
        const bitmap = ResourceManager.getBitmap("Graphics/Pictures/" + imagePath);
        return bitmap?.image?.src || `resources/Graphics/Pictures/${imagePath}`;
    }

    createHTML() {
        const cfg = this.config;
        const cursorStyle = this.getCursorStyle();

        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${cfg.overlayColor};
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
        `;

        const style = document.createElement('style');
        style.textContent = `
            .text-input-overlay, .text-input-overlay * {
                cursor: ${cursorStyle} !important;
            }
        `;
        document.head.appendChild(style);
        this.styleElement = style;
        this.overlay.className = 'text-input-overlay';

        const vnmSkin = this.getVNMSkinImages();
        const customBgUrl = this.getCustomBackgroundUrl(cfg.backgroundImage);
        const buttonBgUrl = this.getCustomBackgroundUrl(cfg.buttonBackgroundImage);

        this.dialog = document.createElement('div');
        this.dialog.style.cssText = `
            position: relative;
            padding: ${cfg.padding}px;
            width: ${cfg.width}px;
            ${this.getPositionCSS()}
        `;

        if (customBgUrl) {
            const bgDiv = document.createElement('div');
            bgDiv.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: url('${customBgUrl}') center/cover no-repeat;
                z-index: 1;
            `;
            this.dialog.appendChild(bgDiv);
        } else if (cfg.backgroundColor) {
            const bgDiv = document.createElement('div');
            bgDiv.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: ${cfg.backgroundColor};
                z-index: 1;
            `;
            this.dialog.appendChild(bgDiv);
        } else {
            if (vnmSkin.tile) {
                const tileBg = document.createElement('div');
                tileBg.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: url('${vnmSkin.tile}') repeat;
                    z-index: 1;
                `;
                this.dialog.appendChild(tileBg);
            }

            if (vnmSkin.stretch) {
                const stretchBg = document.createElement('div');
                stretchBg.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: url('${vnmSkin.stretch}') center/cover;
                    z-index: 2;
                `;
                this.dialog.appendChild(stretchBg);
            }
        }

        if (!customBgUrl && !cfg.backgroundColor && vnmSkin.frame) {
            const frameBorder = document.createElement('div');
            frameBorder.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                border: 16px solid transparent;
                border-image: url('${vnmSkin.frame}') 16 round;
                pointer-events: none;
                z-index: 3;
            `;
            this.dialog.appendChild(frameBorder);
        }

        const messageEl = document.createElement('div');
        messageEl.textContent = this.message;
        messageEl.style.cssText = `
            position: relative;
            z-index: 10;
            font-family: ${cfg.fontFamily};
            font-size: ${cfg.fontSize}px;
            color: ${cfg.fontColor};
            text-align: center;
            margin-bottom: 25px;
            text-shadow: ${this.getTextShadow(cfg.outlineColor, cfg.outlineWidth)};
        `;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.maxLength = this.maxLength;
        this.input.placeholder = cfg.inputPlaceholder;
        this.input.style.cssText = `
            position: relative;
            z-index: 10;
            width: 100%;
            padding: 15px 20px;
            font-family: ${cfg.fontFamily};
            font-size: ${cfg.inputFontSize}px;
            font-style: italic;
            text-align: center;
            border: none;
            background: ${cfg.inputBackgroundColor};
            color: ${cfg.inputTextColor};
            box-sizing: border-box;
            outline: none;
        `;

        let instructionsEl = null;
        if (cfg.showInstructions) {
            instructionsEl = document.createElement('div');
            instructionsEl.textContent = cfg.instructionsText;
            instructionsEl.style.cssText = `
                position: relative;
                z-index: 10;
                font-family: ${cfg.fontFamily};
                font-size: ${cfg.instructionsFontSize}px;
                color: ${cfg.fontColor};
                text-align: center;
                margin: 25px 0;
                text-shadow: ${this.getTextShadow(cfg.outlineColor, cfg.outlineWidth)};
            `;
        }

        let buttonContainer = null;
        if (cfg.showButtons) {
            buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                position: relative;
                z-index: 10;
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-top: 15px;
            `;

            const createButton = (text, onClick) => {
                const btn = document.createElement('div');
                btn.style.cssText = `
                    position: relative;
                    padding: 12px 35px;
                    cursor: pointer;
                    min-width: 120px;
                    text-align: center;
                `;

                if (buttonBgUrl) {
                    const btnBg = document.createElement('div');
                    btnBg.style.cssText = `
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: url('${buttonBgUrl}') center/cover no-repeat;
                        z-index: 1;
                    `;
                    btn.appendChild(btnBg);
                } else if (cfg.buttonBackgroundColor) {
                    const btnBg = document.createElement('div');
                    btnBg.style.cssText = `
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: ${cfg.buttonBackgroundColor};
                        z-index: 1;
                    `;
                    btn.appendChild(btnBg);
                } else {
                    if (vnmSkin.tile) {
                        const btnTile = document.createElement('div');
                        btnTile.style.cssText = `
                            position: absolute;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background: url('${vnmSkin.tile}') repeat;
                            z-index: 1;
                        `;
                        btn.appendChild(btnTile);
                    }

                    if (vnmSkin.stretch) {
                        const btnStretch = document.createElement('div');
                        btnStretch.style.cssText = `
                            position: absolute;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background: url('${vnmSkin.stretch}') center/cover;
                            z-index: 2;
                        `;
                        btn.appendChild(btnStretch);
                    }
                }

                const btnFrame = document.createElement('div');
                btnFrame.className = 'btn-frame';
                btnFrame.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    ${vnmSkin.frame && !buttonBgUrl && !cfg.buttonBackgroundColor ?
                        `border: 8px solid transparent; border-image: url('${vnmSkin.frame}') 8 round;` :
                        'border: 2px solid rgba(255,255,255,0.3);'}
                    pointer-events: none;
                    z-index: 3;
                    transition: box-shadow 0.15s ease;
                `;
                btn.appendChild(btnFrame);

                const btnText = document.createElement('span');
                btnText.textContent = text;
                btnText.style.cssText = `
                    position: relative;
                    z-index: 4;
                    font-family: ${cfg.fontFamily};
                    font-size: ${cfg.buttonFontSize}px;
                    font-style: italic;
                    font-variant: small-caps;
                    color: ${cfg.buttonTextColor};
                    text-shadow: ${this.getTextShadow(cfg.outlineColor, cfg.outlineWidth)};
                `;
                btn.appendChild(btnText);

                btn.onmouseenter = () => {
                    btnFrame.style.boxShadow = '0 0 12px 4px rgba(100, 150, 255, 0.7)';
                    this.playSelectSound();
                };
                btn.onmouseleave = () => {
                    btnFrame.style.boxShadow = 'none';
                };
                btn.onclick = onClick;

                return btn;
            };

            const confirmBtn = createButton(cfg.confirmButtonText, () => this.handleConfirm());
            const cancelBtn = createButton(cfg.cancelButtonText, () => this.handleCancel());

            buttonContainer.appendChild(confirmBtn);
            buttonContainer.appendChild(cancelBtn);
        }

        this.dialog.appendChild(messageEl);
        this.dialog.appendChild(this.input);
        if (instructionsEl) this.dialog.appendChild(instructionsEl);
        if (buttonContainer) this.dialog.appendChild(buttonContainer);

        this.overlay.appendChild(this.dialog);
        document.body.appendChild(this.overlay);
    }

    setupEventListeners() {
        this.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                this.handleConfirm();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.handleCancel();
            }
        });

        if (this.allowedCharsRegex) {
            this.input.addEventListener('input', () => {
                const currentValue = this.input.value;
                if (!this.isAllowedText(currentValue)) {
                    let filtered = '';
                    for (const char of currentValue) {
                        if (this.isAllowedText(char)) {
                            filtered += char;
                        }
                    }
                    this.input.value = filtered;
                }
            });
        }
    }

    handleConfirm() {
        this.playConfirmSound();
        this.inputText = this.input.value;

        if (GameManager && GameManager.variableStore) {
            GameManager.variableStore.setStringValueTo({
                scope: 1,
                index: this.variableId - 1,
                domain: GameManager.variableStore.domains[0]
            }, this.inputText);
        }

        if (this.confirmLabel) {
            const scene = SceneManager.scene;
            if (scene && scene.interpreter) {
                scene.interpreter.jumpToLabel(this.confirmLabel);
            }
        }

        this.dispose();
    }

    handleCancel() {
        this.playCancelSound();

        if (this.cancelLabel) {
            const scene = SceneManager.scene;
            if (scene && scene.interpreter) {
                scene.interpreter.jumpToLabel(this.cancelLabel);
            }
        }

        this.dispose();
    }

    dispose() {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }

        if (this.styleElement) {
            document.head.removeChild(this.styleElement);
            this.styleElement = null;
        }

        if (window._activeTextInputDialog === this) {
            window._activeTextInputDialog = null;
        }
    }
}

window.showTextInput = function(variableId, message, maxLength, confirmLabel, cancelLabel, allowedChars) {
    const dialog = new TextInputDialog(variableId, message, maxLength, confirmLabel, cancelLabel, allowedChars);
    dialog.show();
};

window.showNameInput = function(message, variableId, maxLength, domain, confirmLabel, cancelLabel) {
    showTextInput(variableId, message, maxLength, confirmLabel, cancelLabel);
};

