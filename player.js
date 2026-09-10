/* Плеер для выложенной копии композиции.
   В студии превью расписанием клипов и ходом времени управляет сама студия;
   на обычной странице этого некому делать — таймлайн создаётся на паузе, и
   зритель видит застывший первый кадр. Здесь минимум, который делает страницу
   смотрибельной: ход времени, показ клипов по их окну, звук как часы. */
(function () {
  function ready(fn) {
    if (document.readyState === "complete") return setTimeout(fn, 400);
    window.addEventListener("load", function () { setTimeout(fn, 400); });
  }

  ready(function () {
    var tl = window.__timelines && window.__timelines.main;
    if (!tl) return;
    var DUR = tl.duration();
    var audio = document.querySelector('audio.clip, audio#au-mix');
    var clips = [].slice.call(document.querySelectorAll('.clip')).map(function (el) {
      return { el: el, a: parseFloat(el.dataset.start) || 0,
               d: parseFloat(el.dataset.duration) || 0,
               vid: el.tagName === "VIDEO", aud: el.tagName === "AUDIO" };
    });


    /* ---- вписать сцену в окно ----
       Композиция свёрстана в 1920x1080 и телом страницы жёстко задана в этих
       же пикселях. В студии превью её масштабирует сама студия; здесь делаем
       то же: держим пропорции и центрируем, снизу оставляем место под панель. */
    var root = document.getElementById("root");
    if (root) {
      var W = parseFloat(root.dataset.width) || 1920;
      var H = parseFloat(root.dataset.height) || 1080;
      var wrap = document.createElement("div");
      wrap.className = "hfp-stage";
      root.parentNode.insertBefore(wrap, root);
      wrap.appendChild(root);
      var css2 = document.createElement("style");
      css2.textContent =
        'html,body{width:100%!important;height:100%!important;margin:0;background:#0b0f09!important;overflow:hidden}' +
        '.hfp-stage{position:fixed;inset:0 0 46px 0;display:flex;align-items:center;justify-content:center}' +
        '.hfp-stage>#root{transform-origin:50% 50%;flex:0 0 auto}';
      document.head.appendChild(css2);
      var fit = function () {
        var box = wrap.getBoundingClientRect();
        var k = Math.min(box.width / W, box.height / H);
        root.style.transform = "scale(" + k + ")";
      };
      fit();
      window.addEventListener("resize", fit);
      document.addEventListener("fullscreenchange", function () { setTimeout(fit, 60); });
    }

    /* ---- панель управления ---- */
    var bar = document.createElement("div");
    bar.className = "hfp";
    bar.innerHTML =
      '<button class="hfp-b" id="hfp-play" aria-label="Пуск">▶</button>' +
      '<span class="hfp-t" id="hfp-cur">0:00</span>' +
      '<div class="hfp-line" id="hfp-line"><i id="hfp-fill"></i></div>' +
      '<span class="hfp-t" id="hfp-dur">0:00</span>' +
      '<button class="hfp-b" id="hfp-full" aria-label="Во весь экран">⛶</button>';
    var css = document.createElement("style");
    css.textContent =
      '.hfp{position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;gap:12px;' +
      'align-items:center;padding:10px 16px;background:rgba(10,16,8,.86);' +
      'backdrop-filter:blur(8px);font:14px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#e8efe4}' +
      '.hfp-b{background:none;border:0;color:#e8efe4;font-size:18px;cursor:pointer;padding:2px 6px}' +
      '.hfp-t{font-variant-numeric:tabular-nums;color:#9fb497;min-width:44px;text-align:center}' +
      '.hfp-line{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.18);cursor:pointer;position:relative}' +
      '.hfp-line i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:3px;background:#6faf3d;display:block}' +
      '.hfp-start{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(8,14,6,.55);cursor:pointer}' +
      '.hfp-start span{width:96px;height:96px;border-radius:50%;background:rgba(61,122,31,.92);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;font-size:40px;padding-left:6px}';
    document.head.appendChild(css);
    document.body.appendChild(bar);

    var el = function (id) { return document.getElementById(id); };
    var mmss = function (s) {
      s = Math.max(0, Math.round(s));
      return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    };
    el("hfp-dur").textContent = mmss(DUR);

    /* ---- расписание клипов ---- */
    function schedule(t) {
      for (var i = 0; i < clips.length; i++) {
        var c = clips[i];
        if (c.aud) continue;                       // звук — часы, его не прячем
        var on = t >= c.a - 0.01 && t < c.a + c.d;
        var want = on ? "" : "none";
        if (c.el.style.display !== want) c.el.style.display = want;
        if (on && c.vid) {
          var want2 = Math.min(Math.max(0, t - c.a), (c.el.duration || 1e9) - 0.05);
          if (Math.abs(c.el.currentTime - want2) > 0.35) { try { c.el.currentTime = want2; } catch (e) {} }
          if (c.el.paused && playing) c.el.play().catch(function () {});
        } else if (!on && c.vid && !c.el.paused) { c.el.pause(); }
      }
    }

    /* ---- ход времени: часы — звук, если он есть ---- */
    var playing = false, base = 0, t0 = 0;
    function now() {
      if (audio && !audio.paused) return audio.currentTime;
      return base + (playing ? (performance.now() - t0) / 1000 : 0);
    }
    function frame() {
      var t = Math.min(now(), DUR);
      tl.time(t);
      schedule(t);
      el("hfp-fill").style.width = (t / DUR * 100) + "%";
      el("hfp-cur").textContent = mmss(t);
      if (t >= DUR - 0.05) { pause(); }
      if (playing) requestAnimationFrame(frame);
    }
    function play() {
      playing = true; t0 = performance.now();
      if (audio) { audio.currentTime = base; audio.play().catch(function () {}); }
      el("hfp-play").textContent = "❚❚";
      requestAnimationFrame(frame);
    }
    function pause() {
      base = now(); playing = false;
      if (audio) audio.pause();
      clips.forEach(function (c) { if (c.vid && !c.el.paused) c.el.pause(); });
      el("hfp-play").textContent = "▶";
    }
    function seek(t) {
      base = Math.max(0, Math.min(t, DUR)); t0 = performance.now();
      if (audio) audio.currentTime = base;
      tl.time(base); schedule(base);
      el("hfp-fill").style.width = (base / DUR * 100) + "%";
      el("hfp-cur").textContent = mmss(base);
    }

    el("hfp-play").addEventListener("click", function () { playing ? pause() : play(); });
    el("hfp-line").addEventListener("click", function (e) {
      var r = this.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width * DUR);
    });
    el("hfp-full").addEventListener("click", function () {
      var d = document.documentElement;
      document.fullscreenElement ? document.exitFullscreen() : d.requestFullscreen();
    });
    document.addEventListener("keydown", function (e) {
      if (e.code === "Space") { e.preventDefault(); playing ? pause() : play(); }
      if (e.code === "ArrowRight") seek(now() + 10);
      if (e.code === "ArrowLeft") seek(now() - 10);
    });

    /* Со звуком браузер не даст запуститься без действия зрителя — просим нажать. */
    var start = document.createElement("div");
    start.className = "hfp-start";
    start.innerHTML = "<span>▶</span>";
    start.addEventListener("click", function () { start.remove(); play(); });
    document.body.appendChild(start);

    seek(0);
  });
})();
