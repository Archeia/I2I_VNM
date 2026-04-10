// ===================================================================
//   Fix MessageAreaVisibility
//   Author: Archeia
//   Version: 1.0.0
// -------------------------------------------------------------------
//
// Fixes an issue with create message area command not affected by
// spacebar hide.
//
// ===================================================================

(function() {
    var _changeUIVisibility = vn.Component_GameSceneBehavior.prototype.changeUIVisibility;
    vn.Component_GameSceneBehavior.prototype.changeUIVisibility = function(visible) {
        _changeUIVisibility.call(this, visible);

        var mac = this.object.messageAreaContainer;
        if (mac) {
            if (mac.behavior && mac.behavior.setVisible) {
                mac.behavior.setVisible(visible);
            }

            var areas = this.object.messageAreas;
            if (areas) {
                for (var i = 0; i < areas.length; i++) {
                    var area = areas[i];
                    if (area) {
                        area.visible = visible;
                        if (area.layout) {
                            area.layout.visible = visible;
                        }
                        if (area.message) {
                            area.message.visible = visible;
                        }
                    }
                }
            }
        }
    };


})();
