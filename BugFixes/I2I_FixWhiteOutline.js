// ===================================================================
//
//   Script: I2I Fix WhiteOutline
//   Author: Iris to Id
//   Version: 2.0.0
//
// ===================================================================
//
//   Fixes white outline/fringe artifacts on character sprites during zoom-out.
//
// ===================================================================

(function() {

    var _createImageBitmap = window.createImageBitmap;
    if (_createImageBitmap) {
        window.createImageBitmap = function() {
            var args = Array.prototype.slice.call(arguments);
            var last = args[args.length - 1];

            if (last && typeof last === "object" && !(last instanceof HTMLElement) &&
                !(typeof ImageBitmap !== "undefined" && last instanceof ImageBitmap) &&
                !(last instanceof Blob) && !(last instanceof HTMLCanvasElement) &&
                !(last instanceof HTMLImageElement) && !(last instanceof HTMLVideoElement) &&
                typeof last.premultiplyAlpha !== "undefined") {
                // Options object in either signature — force premultiply
                last.premultiplyAlpha = "premultiply";
            } else if (args.length === 1 ||
                       (args.length >= 2 && typeof args[1] === "number")) {
                // No options present — append one  (source) or (source,sx,sy,sw,sh)
                args.push({ premultiplyAlpha: "premultiply" });
            }

            return _createImageBitmap.apply(this, args);
        };
    }


    function patchTextureUploads(proto) {
        if (!proto) return;

        var _texImage2D = proto.texImage2D;
        proto.texImage2D = function() {
            this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            var r = _texImage2D.apply(this, arguments);
            this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            return r;
        };

        var _texSubImage2D = proto.texSubImage2D;
        proto.texSubImage2D = function() {
            this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            var r = _texSubImage2D.apply(this, arguments);
            this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            return r;
        };
    }

    patchTextureUploads(window.WebGLRenderingContext &&
                        WebGLRenderingContext.prototype);
    patchTextureUploads(window.WebGL2RenderingContext &&
                        WebGL2RenderingContext.prototype);

    function patchBlendFunc(proto) {
        if (!proto) return;

        var _blendFunc = proto.blendFunc;
        proto.blendFunc = function(sfactor, dfactor) {
            if (sfactor === this.SRC_ALPHA) {
                sfactor = this.ONE;
            }
            return _blendFunc.call(this, sfactor, dfactor);
        };
    }

    patchBlendFunc(window.WebGLRenderingContext &&
                   WebGLRenderingContext.prototype);
    patchBlendFunc(window.WebGL2RenderingContext &&
                   WebGL2RenderingContext.prototype);

})();
