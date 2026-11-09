/* Shared visual roots. Never modifies actor positions, frame metadata, collision or timing. */
(()=>{'use strict';
function x(sheet,n){const f=sheet?.frames?.[n];if(!f)return 0;const original=f.anchorX??f.w/2,r=window.Jerm747FighterRoots?.[sheet.key]?.[n];
 // If an atlas frame is replaced later, its old calibration must not be reused.
 return r&&r[0]===f.x&&r[1]===f.y&&r[2]===f.w&&r[3]===f.h&&r[4]===original?r[5]:original;
}
window.Jerm747FighterRoot={x};
})();
