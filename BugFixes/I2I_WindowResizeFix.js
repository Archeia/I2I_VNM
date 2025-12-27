// ===================================================================
//
//   Script: WindowResizeFix
//   Author: Iris to Id
//
// ===================================================================
//
//   Fixes an issue where the ratio/stretch feature doesn't work
//   properly after maximizing and then unmaximizing a windowed game.
//
//   Supports NW.js, Electron, and browser environments.
//
// ===================================================================

var WindowResizeFix;

WindowResizeFix = (function() {
  function WindowResizeFix() {}

  WindowResizeFix.initialize = function() {
    var electron, remote, win, lastWidth, lastHeight, attached = false;

    if (window.nw != null) {
      win = nw.Window.get();
      win.on("maximize", function() {
        setTimeout(function() { Graphics.onResize(); }, 100);
      });
      win.on("restore", function() {
        setTimeout(function() { Graphics.onResize(); }, 100);
      });
      attached = true;
    } else if (typeof require !== 'undefined') {
      if (!attached) {
        try {
          remote = require('@electron/remote');
          win = remote != null ? (typeof remote.getCurrentWindow === "function" ? remote.getCurrentWindow() : void 0) : void 0;
          if (win != null) {
            win.on("maximize", function() {
              setTimeout(function() { Graphics.onResize(); }, 100);
            });
            win.on("unmaximize", function() {
              setTimeout(function() { Graphics.onResize(); }, 100);
            });
            attached = true;
          }
        } catch (error) {}
      }

      if (!attached) {
        try {
          electron = require('electron');
          remote = electron != null ? electron.remote : void 0;
          win = remote != null ? (typeof remote.getCurrentWindow === "function" ? remote.getCurrentWindow() : void 0) : void 0;
          if (win != null) {
            win.on("maximize", function() {
              setTimeout(function() { Graphics.onResize(); }, 100);
            });
            win.on("unmaximize", function() {
              setTimeout(function() { Graphics.onResize(); }, 100);
            });
            attached = true;
          }
        } catch (error1) {}
      }
    }

    if (!attached) {
      lastWidth = window.innerWidth;
      lastHeight = window.innerHeight;
      var resizeTimeout = null;

      window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
          var newWidth = window.innerWidth;
          var newHeight = window.innerHeight;
          if (Math.abs(newWidth - lastWidth) > 10 || Math.abs(newHeight - lastHeight) > 10) {
            lastWidth = newWidth;
            lastHeight = newHeight;
            Graphics.onResize();
          }
        }, 150);
      });
    }
  };

  return WindowResizeFix;

})();

WindowResizeFix.initialize();
