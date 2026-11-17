// ============ 新生实践作业 · 鹰角网络介绍站 · 交互脚本 ============
// 功能：移动端导航 / 角色轮播 / 背景粒子（可被鼠标撞开）/ BGM 播放器

document.addEventListener('DOMContentLoaded', function () {
  initNav();
  initCarousels();
  initMarquees();
  initParticles();
  initBGM();
});

/* ---------- 移动端导航菜单 ---------- */
function initNav() {
  var btn = document.getElementById('menuBtn');
  var links = document.getElementById('navLinks');
  if (btn && links) {
    btn.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }
}

/* ---------- 角色轮播：箭头 / 圆点 / 拖拽滑动 / 键盘 / 自动播放 ---------- */
function initCarousels() {
  var cars = document.querySelectorAll('[data-carousel]');
  Array.prototype.forEach.call(cars, function (car) {
    var track = car.querySelector('.car-track');
    var slides = track.children;
    var dotsBox = car.querySelector('.car-dots');
    var idx = 0, timer = null, n = slides.length;
    if (!n) return;

    // 生成圆点
    for (var i = 0; i < n; i++) {
      (function (i) {
        var b = document.createElement('button');
        b.setAttribute('aria-label', '第' + (i + 1) + '位');
        b.addEventListener('click', function () { go(i, true); });
        dotsBox.appendChild(b);
      })(i);
    }

    function render() {
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      Array.prototype.forEach.call(dotsBox.children, function (d, i) {
        d.classList.toggle('on', i === idx);
      });
    }
    function go(i, byUser) {
      idx = (i + n) % n;
      render();
      if (byUser) restart();
    }

    car.querySelector('.prev').addEventListener('click', function () { go(idx - 1, true); });
    car.querySelector('.next').addEventListener('click', function () { go(idx + 1, true); });

    // 触屏 / 鼠标拖拽滑动
    var startX = null, moved = 0;
    track.addEventListener('pointerdown', function (e) {
      startX = e.clientX; moved = 0;
    });
    track.addEventListener('pointermove', function (e) {
      if (startX === null) return;
      moved = e.clientX - startX;
    });
    track.addEventListener('pointerup', function () {
      if (startX === null) return;
      if (Math.abs(moved) > 40) go(idx + (moved < 0 ? 1 : -1), true);
      startX = null; moved = 0;
    });
    track.addEventListener('pointercancel', function () { startX = null; });

    // 键盘左右键（轮播获得焦点时）
    car.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(idx - 1, true);
      if (e.key === 'ArrowRight') go(idx + 1, true);
    });

    // 自动轮播：6 秒一切，悬停暂停
    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { go(idx + 1, false); }, 6000);
    }
    car.addEventListener('mouseenter', function () { clearInterval(timer); });
    car.addEventListener('mouseleave', restart);
    restart();
    render();
  });
}

/* ---------- 背景粒子：带短暂拖尾的光点随风有序流动 ----------
   交互：鼠标快速滑动时把粒子撞开（越快撞得越狠）；
   鼠标静止片刻后，部分粒子会缓缓聚拢过来，再次移动即被撞散。
   粒子从页面四周进入、沿规律的风场流动后从四周离开。 */
function initParticles() {
  var canvas = document.getElementById('fx-particles');
  if (!canvas || !canvas.getContext) return;
  // 尊重"减少动态效果"的系统偏好
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.parentNode.removeChild(canvas);
    return;
  }

  var ctx = canvas.getContext('2d');
  var W, H, parts = [];
  // 粒子颜色跟随页面主题色
  var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#2dd4bf';
  if (accent.indexOf('#') !== 0) accent = '#2dd4bf';

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 鼠标状态：位置 + 平滑速度（碰撞强度与"静止聚拢"都依赖它）
  var mouse = { x: -9999, y: -9999, lx: -9999, ly: -9999, vx: 0, vy: 0, speed: 0, still: 0, inside: false };

  window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
  });
  window.addEventListener('pointerout', function () { mouse.inside = false; });
  window.addEventListener('blur', function () { mouse.inside = false; });

  // 从页面边缘外侧生成（四周进入屏幕）
  function spawn() {
    var side = Math.floor(Math.random() * 4), m = 12, x, y;
    if (side === 0)      { x = Math.random() * W; y = -m; }
    else if (side === 1) { x = W + m; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + m; }
    else                 { x = -m; y = Math.random() * H; }
    var aa = 0.35 + Math.random() * 0.45;   // 透明度
    return {
      x: x, y: y,
      r: 1.4 + Math.random() * 2.4,      // 实心光点，更醒目
      spd: 0.25 + Math.random() * 0.5,   // 顺风基础流速
      ph: Math.random() * Math.PI * 2,   // 个体摆动相位
      sw: 0.1 + Math.random() * 0.35,    // 摆动幅度（很小，保证轨迹有规律）
      a: aa,                             // 当前透明度
      aMax: aa,                          // 淡入目标透明度
      emitted: false,                    // 是否为鼠标静止时在光标处生成
      dead: false,                       // 淡出完毕，待回收
      vx: 0, vy: 0,                      // 与鼠标交互的附加速度
      chase: Math.random() < 0.75,       // 约四分之三的粒子在鼠标静止时会被吸引
      orbR: 12 + Math.random() * 26,     // 专属轨道半径：聚拢时散布在光标四周
      orbA: Math.random() * Math.PI * 2, // 轨道相位
      orbW: (Math.random() < 0.5 ? -1 : 1) * (0.006 + Math.random() * 0.014), // 缓慢的行星式旋转
      trail: []                          // 拖尾轨迹（扁平坐标数组）
    };
  }

  // 鼠标静止时以光标为中心生成新粒子（从透明缓缓淡入）
  function emitAt(x, y) {
    var p = spawn();
    p.emitted = true;
    var ang = Math.random() * Math.PI * 2;
    var rr0 = 8 + Math.random() * 46;
    p.x = x + Math.cos(ang) * rr0;
    p.y = y + Math.sin(ang) * rr0;
    p.a = 0.02;
    return p;
  }

  var count = Math.min(150, Math.floor(window.innerWidth / 9));
  for (var i = 0; i < count; i++) {
    var p0 = spawn();
    if (i % 2 === 0) { p0.x = Math.random() * W; p0.y = Math.random() * H; } // 一半先出生在屏内
    parts.push(p0);
  }

  var running = true, t = 0;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(tick);
  });

  function tick() {
    if (!running) return;
    t++;
    ctx.clearRect(0, 0, W, H);

    // 鼠标速度（帧间平滑）与静止判定
    if (mouse.lx === -9999) { mouse.lx = mouse.x; mouse.ly = mouse.y; }
    var mvx = mouse.x - mouse.lx, mvy = mouse.y - mouse.ly;
    if (!mouse.inside) { mvx = 0; mvy = 0; }
    mouse.vx = mouse.vx * 0.6 + mvx * 0.4;
    mouse.vy = mouse.vy * 0.6 + mvy * 0.4;
    mouse.speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
    mouse.lx = mouse.x; mouse.ly = mouse.y;
    if (mouse.inside && mouse.speed < 0.6) mouse.still++; else mouse.still = 0;
    var gather = mouse.still > 25;   // 静止约 0.4 秒后开始聚拢
    var orbitCount = 0, needClean = false;

    // 缓慢摆动的风场：粒子整体自左向右流动、微微起伏，方向按分钟级周期变化
    var wa = -0.18 + Math.sin(t * 0.0009) * 0.5;
    var wx = Math.cos(wa), wy = Math.sin(wa);

    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.lineCap = 'round';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];

      // —— 与鼠标的交互 ——
      if (mouse.inside) {
        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 256) {    // 16px 碰撞圈：只碰贴着光标的粒子
          var d = Math.sqrt(d2) || 1;
          var f = (16 - d) / 16 * (1.2 + mouse.speed * 0.125);  // 撞开力度减半
          p.vx += dx / d * f + mouse.vx * 0.09;   // 叠加少量鼠标运动方向
          p.vy += dy / d * f + mouse.vy * 0.09;
        } else if (gather && p.chase && d2 < 8100 && orbitCount < 50) {   // 90px 吸引圈，环绕总数≤50
          orbitCount++;
          // 每颗粒子沿自己的轨道绕光标慢速旋转、半径轻微涨落，
          // 形成一圈圈松散的"星环"，而不是全部挤在一点
          p.orbA += p.orbW;
          var rr = p.orbR + Math.sin(t * 0.006 + p.ph) * 6;
          var tx = mouse.x + Math.cos(p.orbA) * rr;
          var ty = mouse.y + Math.sin(p.orbA) * rr;
          p.vx += (tx - p.x) * 0.012;                  // 更温和的弹簧力，缓慢被吸过来
          p.vy += (ty - p.y) * 0.02;
          if (d2 < 100) {                              // 个别粒子钻进光标正中心时轻推开
            var dd0 = Math.sqrt(d2) || 1;
            p.vx += dx / dd0 * 0.12;
            p.vy += dy / dd0 * 0.12;
          }
        }
      }

      // —— 规律运动：顺风漂移 + 轻微正弦起伏 ——
      p.vx *= 0.9; p.vy *= 0.9;   // 交互速度阻尼，撞开后缓缓回到气流中
      p.x += p.vx + wx * p.spd;
      p.y += p.vy + wy * p.spd + Math.sin(t * 0.02 + p.ph) * p.sw;

      // 记录拖尾（保留最近 6 个位置）
      p.trail.push(p.x, p.y);
      if (p.trail.length > 12) p.trail.splice(0, 2);

      // 生成粒子缓缓淡入；鼠标移动后不消散，随风飘到页面边缘才消失
      if (p.emitted && p.a < p.aMax) {
        p.a = Math.min(p.aMax, p.a + 0.015);
      }

      // 从四周离开后，从边缘重新进入
      if (p.x < -24 || p.x > W + 24 || p.y < -24 || p.y > H + 24) {
        if (p.emitted) { p.dead = true; needClean = true; }
        else parts[i] = p = spawn();
      }

      // —— 绘制：短暂拖尾 + 实心光点 ——
      var n = p.trail.length / 2;
      if (n > 1) {
        ctx.strokeStyle = accent;
        for (var s = 1; s < n; s++) {
          var k = s / n;
          ctx.globalAlpha = p.a * k * 0.45;
          ctx.lineWidth = p.r * k;
          ctx.beginPath();
          ctx.moveTo(p.trail[(s - 1) * 2], p.trail[(s - 1) * 2 + 1]);
          ctx.lineTo(p.trail[s * 2], p.trail[s * 2 + 1]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = p.a * (0.9 + 0.1 * Math.sin(t * 0.05 + p.ph)); // 几乎不闪烁
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 鼠标静止时以光标为中心缓慢生成新粒子（环绕总数受 50 上限约束）
    if (gather && mouse.inside && orbitCount < 50 && t % 14 === 0) {
      parts.push(emitAt(mouse.x, mouse.y));
    }
    // 回收淡出的生成粒子
    if (needClean) {
      var kept = [];
      for (var j = 0; j < parts.length; j++) if (!parts[j].dead) kept.push(parts[j]);
      parts = kept;
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------- 限时活动看板：卡片无缝持续滚动，悬停暂停 ---------- */
function initMarquees() {
  var boxes = document.querySelectorAll('[data-marquee]');
  Array.prototype.forEach.call(boxes, function (box) {
    var track = box.querySelector('.mar-track');
    if (!track) return;
    // 复制整组卡片一次，配合 translateX(-50%) 实现无缝循环
    var items = Array.prototype.slice.call(track.children);
    items.forEach(function (it) { track.appendChild(it.cloneNode(true)); });
  });
}

/* ---------- BGM：进入页面自动播放《生命流》，右下角按钮可暂停/恢复 ---------- */
function initBGM() {
  var btn = document.getElementById('bgmBtn');
  var audio = document.getElementById('bgm');
  if (!btn || !audio) return;

  // 跨页面续播：记录"是否在播 + 进度 + 是否手动暂停过"。
  // 只有用户亲手按了暂停，切换页面后才会保持安静。
  var KEY = 'hycs-bgm-state';
  var lastSave = 0;
  var manualPaused = false;
  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ playing: !audio.paused, time: audio.currentTime || 0, manual: manualPaused }));
    } catch (e) {}
  }

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (saved && saved.playing !== false && typeof saved.time === 'number' && saved.time > 0) {
    var seek = function () { try { audio.currentTime = saved.time; } catch (e) {} };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
  }

  // 首次访问且被浏览器拦截时的提示气泡
  var hint = null;
  function showHint() {
    if (hint) return;
    hint = document.createElement('div');
    hint.className = 'bgm-hint';
    hint.textContent = '点击页面任意位置开启音乐';
    document.body.appendChild(hint);
  }
  function removeHint() {
    if (hint && hint.parentNode) { hint.parentNode.removeChild(hint); }
    hint = null;
  }

  btn.addEventListener('click', function () {
    if (audio.paused) {
      manualPaused = false;
      audio.play();
    } else {
      manualPaused = true;
      audio.pause();
    }
  });
  audio.addEventListener('play', function () {
    manualPaused = false;
    lastSave = audio.currentTime;
    btn.classList.add('playing');
    btn.setAttribute('aria-label', '暂停背景音乐');
    removeHint();
  });
  audio.addEventListener('pause', function () {
    btn.classList.remove('playing');
    btn.setAttribute('aria-label', '播放背景音乐');
    saveState();
  });
  audio.addEventListener('timeupdate', function () {
    // 每 2 秒保存一次进度
    if (!audio.paused && Math.abs(audio.currentTime - lastSave) > 2) {
      lastSave = audio.currentTime;
      saveState();
    }
  });
  window.addEventListener('pagehide', saveState);

  // 自动播放：先直接尝试；被浏览器拦截时，用捕获阶段监听各种首次交互，
  // 一旦发生立即开启（这是浏览器策略下最早的可行时机）
  var events = ['pointerdown', 'keydown', 'touchstart', 'click'];
  function cleanup() {
    events.forEach(function (ev) { document.removeEventListener(ev, firstGesture, true); });
  }
  function firstGesture(e) {
    cleanup();
    removeHint();
    // 点在 BGM 按钮上时交给按钮自身的逻辑处理
    if (e && e.target && btn.contains(e.target)) return;
    if (audio.paused) audio.play().catch(function () {});
  }
  function tryAutoplay() {
    if (saved && saved.playing === false && saved.manual) return; // 用户亲手暂停过，不自动续播
    audio.play().catch(function () {
      events.forEach(function (ev) { document.addEventListener(ev, firstGesture, true); });
      showHint();
    });
  }
  tryAutoplay();

  // 从别的标签页切回来时再试一次（此时可能已有用户激活记录）
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && audio.paused && !manualPaused) {
      audio.play().catch(function () {});
    }
  });
}
