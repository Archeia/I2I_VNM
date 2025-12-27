// ===================================================================
//
//   Script: I2I Backlog (Iris to Id Backlog)
//   Version: 1.4.0
//   Author: Iris to Id (https://iristoid.itch.io/)
//
// DESCRIPTION:
//   A customizable backlog display for Visual Novel Maker.
//   The default one currently has an issue where it doesn't wordwrap
//   properly due to static sizing. Built with pure HTML/CSS.
//
// ===================================================================

// ===========================================
// CONFIGURATION - Edit these values to customize the backlog
// ===========================================
window.I2IBacklogConfig = {
    // --- Window Settings ---
    windowWidth: "85%",           // Width of the backlog window
    windowHeight: "88%",          // Height of the backlog window
    overlayColor: "rgba(0, 0, 0, 0.7)",  // Background overlay color

    // --- Font Settings ---
    fontFamily: '"SansMateo2-Regular", "MS Gothic", "Yu Gothic", "Meiryo", serif',
    nameFontSize: "30px",         // Character name font size
    messageFontSize: "26px",      // Message text font size
    buttonFontSize: "22px",       // Back button font size
    textColor: "#ffffff",         // Default text color
    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",  // Text shadow style

    // --- Layout Settings ---
    nameColumnWidth: "20%",       // Width of the character name column
    entrySpacing: "30px",         // Space between backlog entries
    contentPadding: "20px",       // Padding inside the content area
    buttonPadding: "12px 40px",   // Button padding

    // --- Scrollbar Settings ---
    scrollbarWidth: "14px",
    scrollbarThumbColor: "linear-gradient(to right, #b0b0b0, #d8d8d8, #b0b0b0)",
    scrollbarTrackColor: "rgba(80, 80, 100, 0.3)",

    // --- Mouse Wheel Settings ---
    enableMouseWheelOpen: true,   // Enable opening backlog by scrolling up
    mouseWheelThreshold: 3,       // Number of scroll-up events to trigger open

    // --- Custom Images (leave empty to use VNM skin) ---
    customTileImage: "",          // Custom tile background image path
    customStretchImage: "",       // Custom stretch overlay image path
    customFrameImage: "",         // Custom frame border image path

    // --- Button Settings ---
    buttonText: "Back",           // Text on the back button
    buttonPosition: { bottom: "15px", right: "25px" },

    // --- Use VNM Skin ---
    useVNMSkin: true,             // Set to false to use custom images only
    useVNMCursor: true,           // Set to false to use system cursor

    // --- Choice Display Settings ---
    showChoiceImages: true,       // Show choice box images in backlog
    showAllChoices: true,         // Show all available choices (not just selected)
    choiceImageIdle: "I2I_UI/messageBoxUI/choiceIdle",      // Choice box background
    choiceImageSelected: "I2I_UI/messageBoxUI/choiceSelected_Medens",  // Selected choice overlay
    choiceFontSize: "24px",       // Choice text font size
    choiceTextColor: "#ffffff",   // Choice text color
    choiceUnselectedOpacity: "0.5",  // Opacity for non-selected choices
    choiceSelectedIndicator: "▶", // Symbol to show which choice was selected
    choiceIndicatorColor: "#ffcc00"  // Color of the selected indicator
};

// ===========================================
// BACKLOG CLASS
// ===========================================
class I2IBacklogDialog {
    constructor() {
        this.overlay = null;
        this.container = null;
        this.mainBox = null;
        this.config = window.I2IBacklogConfig;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
    }

    show() {
        window._activeI2IBacklog = this;
        this.lastMouseX = window._i2iLastMouseX || 0;
        this.lastMouseY = window._i2iLastMouseY || 0;
        this.hideVNMCursor();
        this.createHTML();
        this.setupEventListeners();
        this.syncCursorPosition();
    }

    syncCursorPosition() {
        if (this.overlay && this.lastMouseX && this.lastMouseY) {
            const event = new MouseEvent('mousemove', {
                clientX: this.lastMouseX,
                clientY: this.lastMouseY,
                bubbles: true
            });
            this.overlay.dispatchEvent(event);
        }
    }

    hideVNMCursor() {
        if (typeof Graphics !== 'undefined' && Graphics.setCursorBitmap) {
            Graphics.setCursorBitmap(null, 0, 0);
        }
    }

    restoreVNMCursor() {
        if (typeof GameManager !== 'undefined' && GameManager.setupCursor) {
            GameManager.setupCursor();
        }
    }

    getStyleImage(styleName) {
        if (!this.config.useVNMSkin) return "";

        if (!window._vnmSkinCache) window._vnmSkinCache = {};
        if (window._vnmSkinCache[styleName]) return window._vnmSkinCache[styleName];

        const style = ui.UIManager.styles[styleName];
        if (!style) return "";

        const imageName = style.image || style.descriptor?.image;
        if (!imageName) return "";

        let imageFolder = style.descriptor?.imageFolder;
        if (!imageFolder || imageFolder === "Graphics/Pictures") {
            imageFolder = "Graphics/Pictures";
        }

        const bitmap = ResourceManager.getBitmap(imageFolder + "/" + imageName);
        let url = bitmap?.image?.src || "";

        if (!url) {
            url = "resources/" + imageFolder + "/" + imageName;
            if (!url.endsWith('.png')) url += '.png';
        }

        window._vnmSkinCache[styleName] = url;
        return url;
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

    createHTML() {
        const cfg = this.config;
        const backlogData = window.$dataFields?.backlog || [];

        const tileUrl = cfg.customTileImage || this.getStyleImage("windowTilePattern");
        const stretchUrl = cfg.customStretchImage || this.getStyleImage("windowStretchPattern");
        const frameUrl = cfg.customFrameImage || this.getStyleImage("windowFrame");
        const cursorStyle = this.getCursorStyle();

        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: ${cfg.overlayColor};
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100000;
            font-family: ${cfg.fontFamily};
        `;

        const cursorStyleId = 'i2i-backlog-cursor-style';
        if (!document.getElementById(cursorStyleId)) {
            const cursorStyleEl = document.createElement('style');
            cursorStyleEl.id = cursorStyleId;
            cursorStyleEl.textContent = `
                .i2i-backlog-overlay, .i2i-backlog-overlay * {
                    cursor: ${cursorStyle} !important;
                }
                body.i2i-backlog-active,
                body.i2i-backlog-active canvas,
                body.i2i-backlog-active #GameCanvas,
                body.i2i-backlog-active .game-canvas {
                    cursor: none !important;
                }
            `;
            document.head.appendChild(cursorStyleEl);
        }
        this.overlay.className = 'i2i-backlog-overlay';
        document.body.classList.add('i2i-backlog-active');

        this.mainBox = document.createElement('div');
        const mainBox = this.mainBox;
        mainBox.style.cssText = `
            position: relative;
            width: ${cfg.windowWidth};
            height: ${cfg.windowHeight};
            overflow: hidden;
        `;

        const tileBg = document.createElement('div');
        tileBg.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: ${tileUrl ? `url('${tileUrl}') repeat` : 'rgba(20, 20, 40, 0.95)'};
            z-index: 1;
        `;
        mainBox.appendChild(tileBg);

        if (stretchUrl) {
            const stretchBg = document.createElement('div');
            stretchBg.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: url('${stretchUrl}') center/cover;
                z-index: 2;
            `;
            mainBox.appendChild(stretchBg);
        }

        if (frameUrl) {
            const frameBorder = document.createElement('div');
            frameBorder.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                border: 16px solid transparent;
                border-image: url('${frameUrl}') 16 round;
                pointer-events: none;
                z-index: 3;
            `;
            mainBox.appendChild(frameBorder);
        }

        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: absolute;
            top: 20px; left: 20px; right: 20px; bottom: 80px;
            z-index: 10;
            overflow-y: auto;
            overflow-x: hidden;
            padding: ${cfg.contentPadding};
            padding-right: 10px;
            box-sizing: border-box;
            scrollbar-width: thin;
            scrollbar-color: #c8c8c8 ${cfg.scrollbarTrackColor};
        `;

        this.addScrollbarStyles();
        this.container.className = 'i2i-backlog-scroll';

        const mergedEntries = this.mergeConsecutiveEntries(backlogData);
        for (let i = 0; i < mergedEntries.length; i++) {
            this.container.appendChild(this.createEntry(mergedEntries[i]));
        }

        setTimeout(() => {
            this.container.scrollTop = this.container.scrollHeight;
        }, 50);

        const backButton = this.createBackButton(tileUrl, stretchUrl, frameUrl);

        mainBox.appendChild(this.container);
        mainBox.appendChild(backButton);
        this.overlay.appendChild(mainBox);
        document.body.appendChild(this.overlay);
    }

    addScrollbarStyles() {
        const cfg = this.config;
        const styleId = 'i2i-backlog-scrollbar-style';

        if (!document.getElementById(styleId)) {
            const scrollStyle = document.createElement('style');
            scrollStyle.id = styleId;
            scrollStyle.textContent = `
                .i2i-backlog-scroll::-webkit-scrollbar {
                    width: ${cfg.scrollbarWidth};
                }
                .i2i-backlog-scroll::-webkit-scrollbar-track {
                    background: ${cfg.scrollbarTrackColor};
                    border-radius: 7px;
                }
                .i2i-backlog-scroll::-webkit-scrollbar-thumb {
                    background: ${cfg.scrollbarThumbColor};
                    border: 1px solid rgba(150, 150, 150, 0.5);
                    border-radius: 7px;
                }
                .i2i-backlog-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to right, #c0c0c0, #e8e8e8, #c0c0c0);
                }
            `;
            document.head.appendChild(scrollStyle);
        }
    }

    createBackButton(tileUrl, stretchUrl, frameUrl) {
        const cfg = this.config;

        const backButton = document.createElement('div');
        backButton.style.cssText = `
            position: absolute;
            bottom: ${cfg.buttonPosition.bottom};
            right: ${cfg.buttonPosition.right};
            padding: ${cfg.buttonPadding};
            z-index: 20;
            min-width: 100px;
            text-align: center;
        `;

        const btnTile = document.createElement('div');
        btnTile.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: ${tileUrl ? `url('${tileUrl}') repeat` : 'rgba(40, 40, 60, 0.95)'};
            z-index: 1;
        `;
        backButton.appendChild(btnTile);

        if (stretchUrl) {
            const btnStretch = document.createElement('div');
            btnStretch.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: url('${stretchUrl}') center/cover;
                z-index: 2;
            `;
            backButton.appendChild(btnStretch);
        }

        const btnFrame = document.createElement('div');
        btnFrame.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border: ${frameUrl ? '8px solid transparent' : '2px solid #888'};
            ${frameUrl ? `border-image: url('${frameUrl}') 8 round;` : ''}
            pointer-events: none;
            z-index: 3;
            transition: box-shadow 0.15s ease;
        `;
        backButton.appendChild(btnFrame);

        const btnText = document.createElement('span');
        btnText.textContent = cfg.buttonText;
        btnText.style.cssText = `
            position: relative;
            z-index: 10;
            font-family: ${cfg.fontFamily};
            font-size: ${cfg.buttonFontSize};
            font-style: italic;
            color: ${cfg.textColor};
            text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
        `;
        backButton.appendChild(btnText);

        backButton.onmouseenter = () => {
            btnFrame.style.boxShadow = '0 0 12px 4px rgba(100, 150, 255, 0.7)';
        };
        backButton.onmouseleave = () => {
            btnFrame.style.boxShadow = 'none';
        };
        backButton.onclick = () => this.close();

        return backButton;
    }

    createEntry(entry) {
        const cfg = this.config;

        if (entry.isChoice && cfg.showChoiceImages) {
            return this.createChoiceEntry(entry);
        }

        const entryDiv = document.createElement('div');
        entryDiv.style.cssText = `
            display: flex;
            margin-bottom: ${cfg.entrySpacing};
            gap: 20px;
        `;

        // Character name column
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = `
            width: ${cfg.nameColumnWidth};
            color: ${this.getColorString(entry.character?.textColor) || cfg.textColor};
            font-size: ${cfg.nameFontSize};
            text-align: left;
            text-shadow: ${cfg.textShadow};
            flex-shrink: 0;
        `;

        let characterName = "";
        if (entry.character?.name) {
            if (typeof entry.character.name === 'string') {
                characterName = entry.character.name;
            } else if (entry.character.name.defaultText) {
                characterName = entry.character.name.defaultText;
            } else {
                characterName = entry.character.name.text || entry.character.name.value || "";
            }
        }
        nameDiv.textContent = characterName;

        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            flex: 1;
            color: ${cfg.textColor};
            font-size: ${cfg.messageFontSize};
            text-shadow: ${cfg.textShadow};
            word-wrap: break-word;
            white-space: normal;
        `;

        const messageText = this.extractText(entry.message);
        messageDiv.innerHTML = this.formatText(messageText);

        entryDiv.appendChild(nameDiv);
        entryDiv.appendChild(messageDiv);

        return entryDiv;
    }

    createChoiceEntry(entry) {
        const cfg = this.config;

        const entryDiv = document.createElement('div');
        entryDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            margin-bottom: ${cfg.entrySpacing};
            padding-left: ${cfg.nameColumnWidth};
            gap: 8px;
        `;

        const allChoices = entry.allChoices || null;
        const selectedIndex = entry.selectedIndex ?? -1;

        if (cfg.showAllChoices && allChoices && allChoices.length > 0) {
            for (let i = 0; i < allChoices.length; i++) {
                const isSelected = (i === selectedIndex);
                const choiceData = allChoices[i];
                const choiceBox = this.createSingleChoiceBox(choiceData, isSelected, cfg);
                entryDiv.appendChild(choiceBox);
            }
        } else {
            const choiceBox = this.createSingleChoiceBox(entry.choice, true, cfg);
            entryDiv.appendChild(choiceBox);
        }

        return entryDiv;
    }

    createSingleChoiceBox(choiceData, isSelected, cfg) {
        const idleImageUrl = this.getImageUrl(cfg.choiceImageIdle);
        const selectedImageUrl = this.getImageUrl(cfg.choiceImageSelected);

        const choiceBox = document.createElement('div');
        choiceBox.style.cssText = `
            position: relative;
            display: inline-block;
            min-width: 200px;
            max-width: 80%;
            opacity: ${isSelected ? '1' : cfg.choiceUnselectedOpacity};
            transition: opacity 0.2s;
        `;

        const choiceText = this.extractText(choiceData?.text);

        if (idleImageUrl) {
            const bgImg = document.createElement('img');
            bgImg.src = idleImageUrl;
            bgImg.style.cssText = `
                width: 100%;
                height: auto;
                display: block;
            `;
            bgImg.onerror = () => { bgImg.style.display = 'none'; };
            choiceBox.appendChild(bgImg);

            if (isSelected && selectedImageUrl) {
                const selectedImg = document.createElement('img');
                selectedImg.src = selectedImageUrl;
                selectedImg.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    opacity: 0.8;
                `;
                selectedImg.onerror = () => { selectedImg.style.display = 'none'; };
                choiceBox.appendChild(selectedImg);
            }

            const textOverlay = document.createElement('div');
            textOverlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: ${cfg.choiceTextColor};
                font-size: ${cfg.choiceFontSize};
                text-shadow: ${cfg.textShadow};
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 8px;
            `;

            if (isSelected) {
                const indicator = document.createElement('span');
                indicator.textContent = cfg.choiceSelectedIndicator;
                indicator.style.cssText = `
                    color: ${cfg.choiceIndicatorColor};
                    font-size: ${cfg.choiceFontSize};
                `;
                textOverlay.appendChild(indicator);
            }

            const textSpan = document.createElement('span');
            textSpan.innerHTML = this.formatText(choiceText);
            textOverlay.appendChild(textSpan);

            choiceBox.appendChild(textOverlay);
        } else {
            choiceBox.style.cssText += `
                background: rgba(40, 40, 60, 0.8);
                border: 2px solid ${isSelected ? cfg.choiceIndicatorColor : '#666'};
                border-radius: 4px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            `;

            if (isSelected) {
                const indicator = document.createElement('span');
                indicator.textContent = cfg.choiceSelectedIndicator;
                indicator.style.cssText = `
                    color: ${cfg.choiceIndicatorColor};
                    font-size: ${cfg.choiceFontSize};
                `;
                choiceBox.appendChild(indicator);
            }

            const textSpan = document.createElement('span');
            textSpan.style.cssText = `
                color: ${cfg.choiceTextColor};
                font-size: ${cfg.choiceFontSize};
                text-shadow: ${cfg.textShadow};
            `;
            textSpan.innerHTML = this.formatText(choiceText);
            choiceBox.appendChild(textSpan);
        }

        return choiceBox;
    }

    getImageUrl(imagePath) {
        if (!imagePath) return "";

        if (!window._vnmImageCache) window._vnmImageCache = {};
        if (window._vnmImageCache[imagePath]) return window._vnmImageCache[imagePath];

        try {
            const bitmap = ResourceManager.getBitmap("Graphics/Pictures/" + imagePath);
            if (bitmap?.image?.src) {
                window._vnmImageCache[imagePath] = bitmap.image.src;
                return bitmap.image.src;
            }
        } catch (e) {}

        let url = "resources/Graphics/Pictures/" + imagePath;
        if (!url.endsWith('.png')) url += '.png';

        window._vnmImageCache[imagePath] = url;
        return url;
    }

    extractText(textObj) {
        if (!textObj) return "";
        if (typeof textObj === 'string') return textObj;
        if (textObj.defaultText) return textObj.defaultText;
        if (textObj.text) return this.extractText(textObj.text);
        if (textObj.value) return textObj.value;
        return String(textObj);
    }

    mergeConsecutiveEntries(backlogData) {
        if (!backlogData || backlogData.length === 0) return [];

        const merged = [];
        let currentEntry = null;

        for (let i = 0; i < backlogData.length; i++) {
            const entry = backlogData[i];

            if (entry.isChoice) {
                if (currentEntry) {
                    merged.push(currentEntry);
                    currentEntry = null;
                }
                merged.push(entry);
                continue;
            }

            const getCharId = (e) => {
                if (!e || !e.character) return null;
                return e.character.index ?? e.character.id ?? null;
            };

            const currentCharId = getCharId(entry);
            const prevCharId = currentEntry ? getCharId(currentEntry) : null;

            if (currentEntry && currentCharId === prevCharId && currentCharId !== null) {
                const currentMsg = this.extractText(currentEntry.message);
                const newMsg = this.extractText(entry.message);

                const processedNewMsg = this.formatText(newMsg).trim();
                if (processedNewMsg) {
                    currentEntry.message = currentMsg + '\n' + newMsg;
                }
            } else {
                if (currentEntry) {
                    merged.push(currentEntry);
                }
                currentEntry = { ...entry };
            }
        }

        if (currentEntry) {
            merged.push(currentEntry);
        }

        return merged;
    }

    formatText(text) {
        const str = this.extractText(text);
        let result = str;

        result = result.replace(/\{DI:Y\}\s*\n+\s*\{DI:N\}\{WE:N\}\s*\n*/gi, '');

        result = result.replace(/\{([A-Za-z]+):([^\}]+)\}/gi, (_match, code, value) => {
            code = code.toUpperCase();

            switch(code) {
                case 'Y':
                    if (value === 'I') return '<i>';
                    if (value === 'B') return '<b>';
                    if (value === 'U') return '<u>';
                    if (value === 'S') return '<s>';
                    if (value === 'N') return '</i></b></u></s>'; // Reset all
                    if (value === 'NI') return '</i>';
                    if (value === 'NB') return '</b>';
                    if (value === 'NU') return '</u>';
                    if (value === 'NS') return '</s>';
                    return '';

                case 'C':
                    if (value === '0') return '</span>';
                    if (value.startsWith('#')) {
                        return `<span style="color: ${value}">`;
                    }
                    const color = this.getVNMColor(parseInt(value));
                    return color ? `<span style="color: ${color}">` : '';

                case 'SZ':
                    return `<span style="font-size: ${value}px">`;

                case 'GN': return this.getVariableValue('numberValueAtIndex', value, 'globalNumbers');
                case 'GT': return this.getVariableValue('stringValueAtIndex', value, 'globalStrings');
                case 'GS': return this.getVariableValue('booleanValueAtIndex', value, 'globalSwitches');
                case 'GL': return this.getVariableValue('listObjectAtIndex', value, 'globalLists');

                case 'LN': return this.getVariableValue('numberValueAtIndex', value, 'localNumbers');
                case 'LT': return this.getVariableValue('stringValueAtIndex', value, 'localStrings');
                case 'LS': return this.getVariableValue('booleanValueAtIndex', value, 'localSwitches');
                case 'LL': return this.getVariableValue('listObjectAtIndex', value, 'localLists');

                case 'PN': return this.getVariableValue('numberValueAtIndex', value, 'persistentNumbers');
                case 'PT': return this.getVariableValue('stringValueAtIndex', value, 'persistentStrings');
                case 'PS': return this.getVariableValue('booleanValueAtIndex', value, 'persistentSwitches');
                case 'PL': return this.getVariableValue('listObjectAtIndex', value, 'persistentLists');

                case 'N':
                    const charName = this.getCharacterName(value);
                    return charName || '';

                case 'RT':
                    const parts = value.split('/');
                    return parts[0] || '';

                case 'W':
                case 'S':
                case 'WE':
                case 'DI':
                case 'CR':
                case 'E':
                case 'A':
                case 'SP':
                case 'LK':
                case 'SLK':
                case 'CE':
                case 'X':
                case 'M':
                    return '';

                default:
                    return '';
            }
        });

        result = result.replace(/\n/g, '<br>');

        return result;
    }

    getVNMColor(index) {
        try {
            const colors = RecordManager?.system?.colors;
            if (colors && colors[index]) {
                const c = colors[index];
                return `rgb(${c.red || 0}, ${c.green || 0}, ${c.blue || 0})`;
            }
        } catch (e) {}
        return null;
    }

    getVariableValue(method, index, fallbackField) {
        try {
            if (GameManager && GameManager[method]) {
                const value = GameManager[method](parseInt(index), 0);
                return value !== undefined ? String(value) : '';
            }
            if (GameManager && GameManager[fallbackField]) {
                const value = GameManager[fallbackField][parseInt(index)];
                return value !== undefined ? String(value) : '';
            }
        } catch (e) {}
        return '';
    }

    getCharacterName(identifier) {
        try {
            if (!RecordManager || !RecordManager.characters) return '';

            const id = parseInt(identifier);
            if (!isNaN(id) && RecordManager.characters[id]) {
                const char = RecordManager.characters[id];
                if (typeof char.name === 'string') return char.name;
                if (char.name?.defaultText) return char.name.defaultText;
                return '';
            }

            return identifier;
        } catch (e) {}
        return '';
    }

    getColorString(colorObj) {
        if (!colorObj) return null;
        return `rgb(${colorObj.red || 255}, ${colorObj.green || 255}, ${colorObj.blue || 255})`;
    }

    setupEventListeners() {
        const escHandler = (event) => {
            if (event.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', escHandler);
        this._escHandler = escHandler;

        const mouseMoveHandler = (event) => {
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        };
        document.addEventListener('mousemove', mouseMoveHandler);
        this._mouseMoveHandler = mouseMoveHandler;

        this.overlay.addEventListener('click', (event) => {
            if (!this.mainBox.contains(event.target)) {
                this.close();
            }
        });
    }

    close() {
        try {
            if (window.$dataFields?.tempSettings) {
                window.$dataFields.tempSettings.logOpened = false;
            }
        } catch (e) {}

        let control = gs.ObjectManager.current.objectById("backlogBox");
        if (!control) control = gs.ObjectManager.current.objectById("backlog");
        if (!control) control = gs.ObjectManager.current.objectById("backlogScrollView");
        if (control) control.dispose();

        this.dispose();
    }

    dispose() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
        }
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
        document.body.classList.remove('i2i-backlog-active');

        this.restoreVNMCursor();

        const canvas = document.querySelector('canvas');
        if (canvas) {
            const event = new MouseEvent('mousemove', {
                clientX: this.lastMouseX,
                clientY: this.lastMouseY,
                bubbles: true
            });
            canvas.dispatchEvent(event);
        }

        if (window._activeI2IBacklog === this) {
            window._activeI2IBacklog = null;
        }
    }
}

// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

window.showI2IBacklog = function() {
    if (window._activeI2IBacklog) return;
    const dialog = new I2IBacklogDialog();
    dialog.show();
};

window.showHTMLBacklog = window.showI2IBacklog;

window.isBacklogOpen = function() {
    return !!window._activeI2IBacklog;
};

// ===========================================
// MOUSE WHEEL SUPPORT
// ===========================================
(function() {
    let scrollUpCount = 0;
    let scrollResetTimer = null;
    const cfg = window.I2IBacklogConfig;

    window.addEventListener('mousemove', function(event) {
        window._i2iLastMouseX = event.clientX;
        window._i2iLastMouseY = event.clientY;
    }, { passive: true });

    window.addEventListener('wheel', function(event) {
        if (!cfg.enableMouseWheelOpen) return;
        if (window._activeI2IBacklog) return;

        const scene = SceneManager?.scene;
        if (!scene || !scene.interpreter) return;

        if (event.deltaY < 0) {
            scrollUpCount++;

            clearTimeout(scrollResetTimer);
            scrollResetTimer = setTimeout(() => {
                scrollUpCount = 0;
            }, 500);

            if (scrollUpCount >= cfg.mouseWheelThreshold) {
                scrollUpCount = 0;
                window.showI2IBacklog();
            }
        } else {
            scrollUpCount = 0;
        }
    }, { passive: true });
})();

// ===========================================
// VNM INTEGRATION
// ===========================================

ui.UiFactory.customTypes["ui.MessageBacklogBox"] = {
    type: "ui.FreeLayout",
    id: "backlog",
    style: "window",
    frame: [0, 0, 1, 1],
    visible: false,
    zIndex: 1,
    order: 80000
};

const _originalCreateControl = Component_LayoutSceneBehavior.prototype.createControl;
Component_LayoutSceneBehavior.prototype.createControl = function(parent, descriptor) {
    const result = _originalCreateControl.call(this, parent, descriptor);

    const descName = typeof descriptor === 'string' ? descriptor : descriptor?.descriptor;
    if (descName === "ui.MessageBacklogBox" || descName === "ui.MessageBacklog") {
        window.showI2IBacklog();
    }

    return result;
};

Component_CommandInterpreter.prototype.commandBacklogVisibility = function() {
    if (this.params.visible) {
        let control = gs.ObjectManager.current.objectById("backlogBox");
        if (!control) control = gs.ObjectManager.current.objectById("backlog");
        if (control) control.dispose();

        SceneManager.scene.behavior.createControl(this, {
            descriptor: "ui.MessageBacklogBox"
        });
    } else {
        if (window._activeI2IBacklog) {
            window._activeI2IBacklog.close();
        }
    }
};

// ===========================================
// CHOICE CAPTURE HOOK
// ===========================================

window._i2iCurrentChoices = null;
window._i2iSelectedIndex = -1;

(function() {
    const hookInterpreter = () => {
        if (typeof Component_CommandInterpreter !== 'undefined' && Component_CommandInterpreter.prototype) {
            if (!Component_CommandInterpreter.prototype._i2iChoiceHooked) {
                Component_CommandInterpreter.prototype._i2iChoiceHooked = true;

                const _originalShowChoices = Component_CommandInterpreter.prototype.commandShowChoices;
                if (_originalShowChoices) {
                    Component_CommandInterpreter.prototype.commandShowChoices = function() {
                        const result = _originalShowChoices.call(this);

                        const choices = window.$dataFields?.scene?.choices || [];
                        if (choices.length > 0) {
                            window._i2iCurrentChoices = choices.map(c => ({
                                text: c?.text,
                                enabled: c?.isEnabled !== false
                            }));
                        }

                        return result;
                    };
                }
            }
            return true;
        }
        return false;
    };

    if (!hookInterpreter()) {
        const hookWatcher = setInterval(() => {
            if (hookInterpreter()) {
                clearInterval(hookWatcher);
            }
        }, 100);
    }
})();

function i2iExtractTextForCompare(textObj) {
    if (!textObj) return "";
    if (typeof textObj === 'string') return textObj;
    if (textObj.defaultText) return textObj.defaultText;
    if (textObj.text) return i2iExtractTextForCompare(textObj.text);
    if (textObj.value) return textObj.value;
    return String(textObj);
}

(function() {
    const hookBacklog = () => {
        const backlog = window.$dataFields?.backlog;
        if (backlog && !backlog._i2iHooked) {
            backlog._i2iHooked = true;

            const originalBacklogPush = backlog.push.bind(backlog);
            backlog.push = function(entry) {
                if (entry && entry.isChoice && window._i2iCurrentChoices && window._i2iCurrentChoices.length > 0) {
                    entry.allChoices = window._i2iCurrentChoices;

                    const selectedText = i2iExtractTextForCompare(entry.choice?.text);
                    entry.selectedIndex = -1;

                    for (let i = 0; i < window._i2iCurrentChoices.length; i++) {
                        const choiceText = i2iExtractTextForCompare(window._i2iCurrentChoices[i].text);
                        if (choiceText === selectedText) {
                            entry.selectedIndex = i;
                            break;
                        }
                    }

                    window._i2iCurrentChoices = null;
                }
                return originalBacklogPush(entry);
            };
            return true;
        }
        return false;
    };

    const backlogWatcher = setInterval(() => {
        if (hookBacklog()) {
            clearInterval(backlogWatcher);
        }
    }, 500);
})();

