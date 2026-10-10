// 山水长卷里的那个人：斗笠、发髻、长衫、腰带、双臂双腿。
//
// 从前这个小人是写死 8 像素高的几个矩形，缩到近景深处就小得认不出人形。
// 现在身高按格子算（一个人约一格八高），再乘放大倍数，所以放到哪一档都是
// 一副人的身量；放大倍数就是下面 CHAR_SCALE 一个数。
//
// 手臂与双腿按走路相位前后摆 —— 这是 2D 这一侧的「骨骼动画」：
// 相位由视图中心的位移推出来（见 main2d.js 的 updateWalk）。

export const CHAR_BASE = 8;      // 原来那个小人的高度（像素），作基准
export const CHAR_SCALE = 5;     // 放大倍数（暂定 5 倍；改回 1 就是原样）
export const CHAR_CELLS = 1.8;   // 一个人大约一格八高

/**
 * 该画多高（屏幕像素）。
 * 两条都满足：不小于原样的 CHAR_SCALE 倍，也不小于「一个人站在地里」的身量。
 * 前者保证你要的放大看得见，后者保证放大到极限时它还是个人、不是擎天柱。
 */
export function charHeight(th, hz) {
  const natural = (th || 4) * CHAR_CELLS * (hz || 0.55);
  return Math.max(CHAR_BASE * CHAR_SCALE, natural);
}

// 配色：深衣、金腰带，压在山水里也认得出
const INK = '#1b1f26';
const ROBE = '#39414f';
const ROBE_DARK = '#2b313c';
const BELT = '#e8c07a';
const SKIN = '#edd0a8';
const LEG = '#23272f';
const HAT = '#cbaa6d';
const HAT_RIM = '#8d7139';
const SHADOW = 'rgba(18, 22, 28, 0.30)';

/**
 * 把旅人画在 (cx, footY)：脚底落在 footY，总身高 H 像素。
 * phase 是走路相位，amp 是摆动幅度（0 = 立定，1 = 正常迈步），face = 1 朝右 / -1 朝左。
 */
export function drawTraveler(ctx, cx, footY, H, phase, face, amp) {
  const u = H / 8;                                  // 以 8 份为单位比划，缩到哪一档都成比例
  const sw = Math.sin(phase || 0) * (amp || 0);      // -1 ~ 1：左脚在前还是右脚在前
  const bob = Math.abs(Math.cos(phase || 0)) * (amp || 0) * 0.22 * u;   // 走路时身子轻轻起伏
  const flip = face < 0 ? -1 : 1;
  const ink = Math.max(1, u * 0.16);

  ctx.save();
  ctx.translate(cx, footY - bob);
  ctx.scale(flip, 1);

  // 影子钉在地上（不随身子起伏），人才不像飘着
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(0, bob, u * 2.5, u * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // 双腿：一前一后。脚底要钉在地上，身子起伏时不能整条腿跟着离地
  ctx.fillStyle = LEG;
  const legW = u * 0.72, legH = u * 1.7;
  ctx.fillRect(-u * 1.5 + sw * u * 0.7, -legH + bob, legW, legH);
  ctx.fillRect(u * 0.78 - sw * u * 0.7, -legH + bob, legW, legH);

  // 长衫：肩窄下摆宽的梯形
  ctx.beginPath();
  ctx.moveTo(-u * 1.55, -u * 5.5);
  ctx.lineTo(u * 1.55, -u * 5.5);
  ctx.lineTo(u * 2.3, -u * 1.35);
  ctx.lineTo(-u * 2.3, -u * 1.35);
  ctx.closePath();
  ctx.fillStyle = ROBE;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = ink;
  ctx.stroke();

  // 腰带
  ctx.fillStyle = BELT;
  ctx.fillRect(-u * 2.05, -u * 3.7, u * 4.1, u * 0.62);

  // 衣襟：两道斜线交成 V 领
  ctx.strokeStyle = ROBE_DARK;
  ctx.lineWidth = Math.max(1, u * 0.22);
  ctx.beginPath();
  ctx.moveTo(-u * 0.95, -u * 5.3);
  ctx.lineTo(0, -u * 4.1);
  ctx.lineTo(u * 0.95, -u * 5.3);
  ctx.stroke();

  // 双臂：与腿反向摆
  ctx.fillStyle = ROBE;
  ctx.strokeStyle = INK;
  ctx.lineWidth = ink;
  const armW = u * 0.62, armH = u * 2.5;
  for (const side of [-1, 1]) {
    const x = side * u * 1.85 + side * sw * u * 0.85;
    ctx.beginPath();
    ctx.rect(x - armW / 2, -u * 5.1, armW, armH);
    ctx.fill();
    ctx.stroke();
  }

  // 头
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, -u * 6.15, u * 1.12, 0, Math.PI * 2);
  ctx.fill();

  // 斗笠：宽檐一顶，压在最上面（帽尖就是身高的顶点）
  ctx.beginPath();
  ctx.moveTo(0, -u * 8);
  ctx.lineTo(u * 3.15, -u * 6.45);
  ctx.lineTo(-u * 3.15, -u * 6.45);
  ctx.closePath();
  ctx.fillStyle = HAT;
  ctx.fill();
  ctx.strokeStyle = HAT_RIM;
  ctx.lineWidth = ink;
  ctx.stroke();

  ctx.restore();
}
