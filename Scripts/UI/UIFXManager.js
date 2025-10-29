// Scripts/UI/UIFXManager.js
var UIFXManager = pc.createScript('uifxManager');

UIFXManager.attributes.add('toastSelector', { type: 'string', default: '#donation-toast', title: 'Toast Selector' });
UIFXManager.attributes.add('confettiCanvasSelector', { type: 'string', default: '#confetti-canvas', title: 'Confetti Canvas Selector' });

function setText(node, text) {
    if (node) {
        node.textContent = String(text == null ? '' : text);
    }
}

function ensureDOM(toastSel, canvasSel) {
    var root = document.querySelector('#ui-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'ui-root';
        root.style.position = 'fixed';
        root.style.inset = '0';
        root.style.pointerEvents = 'none';
        root.style.zIndex = '9999';
        document.body.appendChild(root);
    }

    var existingStyle = document.getElementById('ui-fx-style');
    if (!existingStyle) {
        existingStyle = document.createElement('style');
        existingStyle.id = 'ui-fx-style';
        existingStyle.textContent = [
            '#donation-toast {',
            '  position: absolute;',
            '  left: 50%;',
            '  top: 10%;',
            '  transform: translate(-50%, -42px) scale(0.92);',
            '  opacity: 0;',
            '  pointer-events: none;',
            '  background: radial-gradient(120% 150% at 50% 0%, rgba(255, 242, 184, 0.94), rgba(125, 84, 255, 0.9));',
            '  color: #fff;',
            '  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto;',
            '  font-weight: 700;',
            '  letter-spacing: 0.02em;',
            '  padding: 20px 28px;',
            '  border-radius: 20px;',
            '  backdrop-filter: blur(14px);',
            '  box-shadow: 0 22px 48px rgba(19, 11, 56, 0.48);',
            '  min-width: clamp(260px, 42vw, 440px);',
            '  text-align: center;',
            '  overflow: hidden;',
            '  will-change: transform, opacity;',
            '}',
            '#donation-toast::before {',
            '  content: "";',
            '  position: absolute;',
            '  inset: -24px;',
            '  background: radial-gradient(70% 90% at 50% 0%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0));',
            '  opacity: 0.35;',
            '  filter: blur(18px);',
            '  pointer-events: none;',
            '}',
            '#donation-toast::after {',
            '  content: "";',
            '  position: absolute;',
            '  inset: 0;',
            '  background: linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0));',
            '  mix-blend-mode: screen;',
            '  opacity: 0.25;',
            '  pointer-events: none;',
            '}',
            '#donation-toast .msg, #donation-toast .amt, #donation-toast .detail {',
            '  position: relative;',
            '  display: block;',
            '  z-index: 1;',
            '}',
            '#donation-toast .msg {',
            '  font-size: clamp(20px, 1.8vw, 26px);',
            '  line-height: 1.3;',
            '  text-transform: uppercase;',
            '}',
            '#donation-toast .amt {',
            '  font-size: clamp(28px, 2.5vw, 38px);',
            '  margin-top: 10px;',
            '  color: #ffe681;',
            '  text-shadow: 0 6px 24px rgba(255, 227, 140, 0.65);',
            '}',
            '#donation-toast .detail {',
            '  margin-top: 12px;',
            '  font-size: clamp(14px, 1.15vw, 18px);',
            '  font-weight: 500;',
            '  opacity: 0.92;',
            '}',
            '#confetti-canvas {',
            '  position: fixed;',
            '  inset: 0;',
            '  width: 100vw;',
            '  height: 100vh;',
            '  pointer-events: none;',
            '  opacity: 0;',
            '  mix-blend-mode: screen;',
            '}',
            '.ui-celebration-glow {',
            '  position: absolute;',
            '  inset: 0;',
            '  background: radial-gradient(circle at 50% 25%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0));',
            '  opacity: 0;',
            '  pointer-events: none;',
            '}'
        ].join('\n');
        document.head.appendChild(existingStyle);
    }

    var toast = document.querySelector(toastSel);
    if (!toast) {
        toast = document.createElement('div');
        toast.id = toastSel.replace('#', '');
        var msgSpan = document.createElement('span');
        msgSpan.className = 'msg';
        setText(msgSpan, 'Donation received');
        var amtSpan = document.createElement('span');
        amtSpan.className = 'amt';
        setText(amtSpan, '+0.00 SOL');
        var detailSpan = document.createElement('span');
        detailSpan.className = 'detail';
        setText(detailSpan, 'Thank you for supporting the playground!');
        toast.appendChild(msgSpan);
        toast.appendChild(amtSpan);
        toast.appendChild(detailSpan);
        root.appendChild(toast);
    } else {
        if (!toast.querySelector('.msg')) {
            var fallbackMsg = document.createElement('span');
            fallbackMsg.className = 'msg';
            toast.appendChild(fallbackMsg);
        }
        if (!toast.querySelector('.amt')) {
            var fallbackAmt = document.createElement('span');
            fallbackAmt.className = 'amt';
            toast.appendChild(fallbackAmt);
        }
        if (!toast.querySelector('.detail')) {
            var fallbackDetail = document.createElement('span');
            fallbackDetail.className = 'detail';
            toast.appendChild(fallbackDetail);
        }
    }

    var canvas = document.querySelector(canvasSel);
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = canvasSel.replace('#', '');
        root.appendChild(canvas);
    }
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = canvas.style.opacity || '0';
    canvas.style.zIndex = '9998';

    var glow = root.querySelector('.ui-celebration-glow');
    if (!glow) {
        glow = document.createElement('div');
        glow.className = 'ui-celebration-glow';
        glow.style.zIndex = '9997';
        root.appendChild(glow);
    }

    return { root: root, toast: toast, canvas: canvas, glow: glow };
}

function formatAmount(amount) {
    if (amount == null) {
        return '';
    }
    if (typeof amount !== 'number' || !isFinite(amount)) {
        return '+' + String(amount) + ' SOL';
    }
    var absAmount = Math.abs(amount);
    var decimals = absAmount >= 100 ? 0 : (absAmount >= 10 ? 1 : 2);
    return '+' + amount.toFixed(decimals) + ' SOL';
}

function detailLine(fromName, toName, isSelf) {
    if (fromName && toName) {
        return fromName + ' ➜ ' + toName;
    }
    if (fromName && !isSelf) {
        return 'From ' + fromName;
    }
    if (toName) {
        return 'For ' + toName;
    }
    return 'Thank you for supporting the playground!';
}

function playDonationToast(toastEl, data, glowEl) {
    if (!toastEl || !window.gsap) {
        return;
    }

    var amount = data && data.amount;
    var fromName = data && data.fromName;
    var toName = data && data.toName;
    var isSelf = !!(data && data.isSelf);

    var msgEl = toastEl.querySelector('.msg');
    var amtEl = toastEl.querySelector('.amt');
    var detailEl = toastEl.querySelector('.detail');

    var baseMsg = 'Donation received';
    if (isSelf && toName) {
        baseMsg = 'You donated to ' + toName;
    } else if (!isSelf && fromName) {
        baseMsg = fromName + ' donated';
    }

    setText(msgEl, baseMsg);
    setText(amtEl, formatAmount(amount));
    if (detailEl) {
        setText(detailEl, detailLine(fromName, toName, isSelf));
    }

    if (toastEl._donationTimeline) {
        toastEl._donationTimeline.kill();
    }

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    toastEl._donationTimeline = tl;

    tl.set(toastEl, { y: -60, opacity: 0, scale: 0.88, transformOrigin: '50% 50%' })
        .fromTo(msgEl, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.06)
        .fromTo(amtEl, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1.08, duration: 0.45, ease: 'back.out(1.8)' }, 0.2)
        .to(amtEl, { scale: 1, duration: 0.22, ease: 'sine.out' }, '>-0.18')
        .fromTo(detailEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out' }, 0.32)
        .to(toastEl, { opacity: 1, y: 0, scale: 1.06, duration: 0.6, ease: 'back.out(1.8)' }, 0)
        .to(toastEl, { scale: 1, duration: 0.3, ease: 'sine.out' }, '>-0.3')
        .to(toastEl, { scale: 1.07, duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '+=0.45')
        .to(toastEl, { opacity: 0, y: -32, scale: 0.95, duration: 0.85, ease: 'power2.in', delay: 2.7 });

    tl.eventCallback('onComplete', function () {
        if (toastEl._donationTimeline === tl) {
            toastEl._donationTimeline = null;
        }
    });

    var root = document.querySelector('#ui-root');
    if (glowEl) {
        gsap.timeline({ defaults: { ease: 'power2.out' } })
            .to(glowEl, { opacity: 0.55, duration: 0.4 })
            .to(glowEl, { opacity: 0, duration: 0.9, ease: 'power2.in' }, '+=0.55');
    }

    if (root) {
        var flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.inset = '0';
        flash.style.background = 'linear-gradient(120deg, rgba(255,255,255,0.45), rgba(255,255,255,0))';
        flash.style.opacity = '0';
        flash.style.pointerEvents = 'none';
        root.appendChild(flash);
        gsap.timeline({ defaults: { ease: 'power2.out' } })
            .to(flash, { opacity: 0.3, duration: 0.14 })
            .to(flash, { opacity: 0, duration: 0.45, ease: 'power2.in' })
            .eventCallback('onComplete', function () {
                flash.remove();
            });
    }
}

function playConfettiBurst(canvas, opts) {
    if (!canvas || !window.gsap) {
        return;
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    var width = canvas.clientWidth || window.innerWidth;
    var height = canvas.clientHeight || window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    if (canvas._confettiFadeTween) {
        canvas._confettiFadeTween.kill();
    }
    canvas._confettiFadeTween = gsap.to(canvas, {
        opacity: 1,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto'
    });

    var intensity = 1;
    if (opts && typeof opts.amount === 'number' && isFinite(opts.amount)) {
        intensity = Math.max(0.5, Math.min(opts.amount, 50));
    }

    var baseCount = Math.floor(240 + intensity * 120);
    var palette = (opts && Array.isArray(opts.palette) && opts.palette.length)
        ? opts.palette
        : ['#FEE440', '#4CC9F0', '#FF6B6B', '#B388FF', '#38E991', '#FFD166'];

    var centerX = width * 0.5;
    var centerY = height * 0.35;
    var particles = [];

    function pushParticle(p) {
        particles.push(p);
    }

    for (var i = 0; i < baseCount; i++) {
        var type = i < baseCount * 0.4 ? 'burst' : (i < baseCount * 0.7 ? 'halo' : 'rain');
        var color = palette[i % palette.length];
        var size = 6 + Math.random() * 10;
        var x, y, vx, vy, ttl;

        if (type === 'burst') {
            var angle = Math.random() * Math.PI * 2;
            var speed = 640 + Math.random() * 460;
            x = centerX + (Math.random() - 0.5) * 40;
            y = centerY + (Math.random() - 0.5) * 20;
            vx = Math.cos(angle) * speed;
            vy = Math.sin(angle) * speed - 220;
            ttl = 1.55 + Math.random() * 0.55;
        } else if (type === 'halo') {
            var radius = Math.min(width, height) * (0.18 + Math.random() * 0.32);
            var theta = Math.random() * Math.PI * 2;
            x = centerX + Math.cos(theta) * radius;
            y = centerY + Math.sin(theta) * radius * 0.75;
            vx = (x - centerX) * 1.25;
            vy = (y - centerY) * 1.15 - 90;
            ttl = 1.8 + Math.random() * 0.6;
        } else {
            x = Math.random() * width;
            y = -80 - Math.random() * 140;
            vx = (Math.random() - 0.5) * 240;
            vy = 640 + Math.random() * 340;
            ttl = 2.4 + Math.random() * 0.9;
        }

        pushParticle({
            type: type,
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            w: size * (0.6 + Math.random() * 0.6),
            h: size,
            rot: Math.random() * Math.PI * 2,
            rv: (Math.random() - 0.5) * 6,
            color: color,
            ttl: ttl,
            t: 0,
            drift: (Math.random() - 0.5) * 70
        });
    }

    if (typeof canvas._activeConfetti !== 'number') {
        canvas._activeConfetti = 0;
    }
    canvas._activeConfetti += 1;

    var last = performance.now();
    var alive = true;

    function cleanup() {
        if (!alive) {
            return;
        }
        alive = false;
        gsap.ticker.remove(step);
        canvas._activeConfetti = Math.max(0, canvas._activeConfetti - 1);
        if (canvas._activeConfetti === 0) {
            canvas._confettiFadeTween = gsap.to(canvas, { opacity: 0, duration: 0.65, ease: 'power2.in' });
        }
    }

    function step() {
        if (!alive) {
            return;
        }

        var now = performance.now();
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        var anyAlive = false;
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            if (p.t >= p.ttl) {
                continue;
            }

            p.t += dt;
            if (p.t >= p.ttl) {
                continue;
            }
            anyAlive = true;

            if (p.type === 'burst' || p.type === 'halo') {
                p.vx -= p.vx * 0.35 * dt;
                p.vy += 900 * dt;
            } else {
                p.vx += p.drift * dt * 0.25;
                p.vy += 980 * dt;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.rv * dt;

            var progress = p.t / p.ttl;
            var alpha = Math.max(0, 1 - progress);
            if (p.type === 'halo') {
                alpha *= 0.75;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
            ctx.restore();
        }

        ctx.restore();

        if (!anyAlive) {
            cleanup();
        }
    }

    gsap.ticker.add(step);
    gsap.delayedCall(3.6, cleanup);
}

UIFXManager.prototype.initialize = function () {
    if (typeof window === 'undefined') {
        return;
    }

    if (typeof window.gsap === 'undefined') {
        console.warn('[UIFXManager] GSAP not found. Ensure GSAP is included via external scripts.');
        return;
    }

    var dom = ensureDOM(this.toastSelector, this.confettiCanvasSelector);
    this._toastEl = dom.toast;
    this._canvas = dom.canvas;
    this._glowEl = dom.glow;
    if (this._canvas) {
        this._canvas._glowEl = this._glowEl;
    }

    var self = this;
    this._resizeHandler = function () {
        if (!self._canvas) {
            return;
        }
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var logicalW = self._canvas.clientWidth || window.innerWidth;
        var logicalH = self._canvas.clientHeight || window.innerHeight;
        self._canvas.width = Math.floor(logicalW * dpr);
        self._canvas.height = Math.floor(logicalH * dpr);
        var ctx = self._canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
    };

    window.addEventListener('resize', this._resizeHandler);
    this._resizeHandler();

    this.app.on('ui:donation', this._onDonationEvent, this);
    this.app.on('ui:donation:debug', this._onDonationDebug, this);

    this.on('destroy', function () {
        window.removeEventListener('resize', this._resizeHandler);
        this.app.off('ui:donation', this._onDonationEvent, this);
        this.app.off('ui:donation:debug', this._onDonationDebug, this);
        if (this._canvas && this._canvas._confettiFadeTween) {
            this._canvas._confettiFadeTween.kill();
        }
    }, this);
};

UIFXManager.prototype._onDonationEvent = function (payload) {
    if (!payload) {
        payload = {};
    }
    // playDonationToast(this._toastEl, payload, this._glowEl); // Toast disabled - confetti only
    playConfettiBurst(this._canvas, payload);
};

UIFXManager.prototype._onDonationDebug = function () {
    var payload = {
        amount: 1.25,
        fromName: 'Alice',
        toName: 'Bob',
        isSelf: false
    };
    // playDonationToast(this._toastEl, payload, this._glowEl); // Toast disabled - confetti only
    playConfettiBurst(this._canvas, payload);
};
