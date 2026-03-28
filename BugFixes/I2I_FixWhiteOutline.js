// ===================================================================
//
//   Script: I2I Fix WhiteOutline
//   Author: Iris to Id
//   Version: 1.0.0
//
// ===================================================================
//
//   Fixes white outline/fringe artifacts on character sprites during zoom-out.
//
//   Character sprite PNGs store transparent pixels with white RGB
//   (255,255,255,0). With LINEAR texture filtering (Texture2D.filter = 1),
//   the GPU interpolates between visible edge pixels and adjacent transparent
//   white pixels, bleeding white into the visible edges. Zoom-out amplifies
//   this because more texels are sampled per output pixel.
//
//   Fix: Hook WebGL texture upload at the API level to enable premultiplied
//   alpha. The browser premultiplies RGB by alpha on upload, converting
//   (255,255,255,0) to (0,0,0,0). LINEAR filtering then blends with
//   black-transparent instead of white-transparent.
//
// ===================================================================

(function() {
    var proto = WebGLRenderingContext.prototype;

    var _texImage2D = proto.texImage2D;
    proto.texImage2D = function() {
        this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        return _texImage2D.apply(this, arguments);
    };

    var _texSubImage2D = proto.texSubImage2D;
    proto.texSubImage2D = function() {
        this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        return _texSubImage2D.apply(this, arguments);
    };
})();
