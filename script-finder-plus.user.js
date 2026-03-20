// ==UserScript==
// @name            Script Finder+
// @name:zh-CN      Script Finder 油猴脚本查找
// @description:zh-CN 不等待页面加载直接出现。鼠标甩向右侧立即触发，显示2秒自动隐藏。手机竖版极简设计。
// @namespace       https://github.com/HHXXYY123/script-finder-plus
// @version         2026.3.21.8
// @author          HHXXYY123
// @match           *://*/*
// @connect         greasyfork.org
// @connect         translate.googleapis.com
// @grant           GM_xmlhttpRequest
// @grant             GM_addStyle
// @run-at          document-start
// @license         MIT
// ==/UserScript==

(function () {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isChinese = (navigator.language || 'en').startsWith('zh')
    const domain = window.location.hostname.split('.').slice(-2).join('.')
    
    let neverLoaded = true, collapsed = true, loadedPages = 0, hideTimer = null, isDragging = false
    let moveDist = 0, startY = 0, startTop = 0

    // --- 样式注入 (最优先级) ---
    GM_addStyle(`
        scrbutton.sf-main-btn {
            position: fixed; right: 8px; width: 44px; height: 44px;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; font-weight: bold; border: none; border-radius: 50%;
            background: #1e90ff; color: #fff; cursor: grab; z-index: 2147483647;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.3s;
            user-select: none; touch-action: none; pointer-events: auto;
        }
        @media screen and (max-width: 768px) {
            scrbutton.sf-main-btn {
                width: 28px; height: 60px; border-radius: 6px; right: 4px;
                font-size: 18px; line-height: 1; padding: 0;
            }
        }
        div.sf-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 95%; max-width: 650px; background: #fff; border-radius: 12px; z-index: 2147483647;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5); padding: 15px; max-height: 85vh; overflow-y: auto; color: #333;
        }
        @media (prefers-color-scheme: dark) {
            div.sf-panel { background: #222; color: #ddd; }
            .sf-trans-name, .sf-trans-desc { background: #3a2a1a !important; color: #ff9900 !important; }
        }
    `);

    // --- UI 创建 (立即执行，不等待加载) ---
    const button = document.createElement('scrbutton')
    const panel = document.createElement('div')
    button.className = 'sf-main-btn'
    button.innerHTML = isMobile ? "🔎" : (isChinese ? "脚本<br>查找" : "Find")
    
    const initUI = () => {
        if (document.body && !document.querySelector('.sf-main-btn')) {
            document.body.appendChild(button)
            document.body.appendChild(panel)
            const savedTop = localStorage.getItem('sf-btn-top')
            button.style.top = savedTop ? savedTop + 'px' : '70%'
            showBtn(2000) // 初始显示2秒
        }
    }
    
    // 轮询注入，直到 body 准备好
    const checkBody = setInterval(() => {
        if (document.body) { initUI(); clearInterval(checkBody); }
    }, 50);

    panel.className = 'sf-panel';
    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:10px;">
            <b style="font-size:18px; color:#1e90ff;">Script Finder<span class="sf-total-count" style="font-size:12px; color:#999; font-weight:normal;"></span></b>
            <button class="sf-close" style="border:none; background:none; cursor:pointer; font-size:24px; color:#999;">&times;</button>
        </div>
        <input type="text" class="sf-search" placeholder="搜索脚本..." style="width:100%; padding:10px; margin:10px 0; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">
        <div class="sf-wait-loading" style="text-align:center; padding:20px;">正在获取 GreasyFork 数据...</div>
        <ul class="sf-info-list" style="padding:0; margin:0; list-style:none;"></ul>
        <button class="sf-load-more" style="display:none; width:100%; padding:12px; background:#1e90ff; color:#fff; border:none; border-radius:6px; margin-top:10px;">加载更多</button>
    `;

    // --- 核心显示逻辑：两秒闪现 ---
    function showBtn(duration = 2000) {
        if (!collapsed || isDragging) return;
        clearTimeout(hideTimer);
        button.style.display = isMobile ? 'flex' : 'flex';
        setTimeout(() => button.style.opacity = '0.9', 10);
        hideTimer = setTimeout(() => {
            if (collapsed && !isDragging) {
                button.style.opacity = '0';
                setTimeout(() => { if(button.style.opacity === '0') button.style.display = 'none'; }, 300);
            }
        }, duration);
    }

    // --- 雷达逻辑：全屏捕获靠近右侧的行为 ---
    window.addEventListener('mousemove', (e) => {
        const threshold = 100; // 鼠标距离右侧 100px 内即触发
        if (e.clientX > window.innerWidth - threshold) showBtn(2000);
    }, true);

    window.addEventListener('scroll', () => showBtn(2000), { passive: true });

    // --- 拖动与点击逻辑 ---
    const onStart = (e) => {
        isDragging = true; moveDist = 0; button.style.transition = 'none';
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        startY = cy; startTop = button.offsetTop; clearTimeout(hideTimer);
    }
    const onMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dy = cy - startY; moveDist = Math.abs(dy);
        const nt = Math.max(10, Math.min(startTop + dy, window.innerHeight - 60));
        button.style.top = nt + 'px';
    }
    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        button.style.transition = 'opacity 0.3s';
        localStorage.setItem('sf-btn-top', parseInt(button.style.top));
        showBtn(2000);
    }

    button.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    button.addEventListener('touchstart', onStart, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onEnd);

    button.onclick = () => {
        if (moveDist > 5) return;
        panel.style.display = 'block';
        collapsed = false;
        if (neverLoaded) { fetchScripts(); neverLoaded = false; }
    };

    panel.querySelector('.sf-close').onclick = () => { panel.style.display = 'none'; collapsed = true; showBtn(2000); };
    
    // --- 数据获取与翻译 (保持高性能异步) ---
    function fetchScripts(page = 1) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&page=${page}`,
            timeout: 10000,
            onload: (res) => {
                panel.querySelector('.sf-wait-loading').style.display = 'none';
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                const scripts = doc.querySelectorAll('#browse-script-list [data-script-id]');
                if (!scripts.length && page === 1) {
                    panel.querySelector('.sf-wait-loading').innerText = "该域暂无可用的脚本";
                    panel.querySelector('.sf-wait-loading').style.display = 'block';
                    return;
                }
                let delay = 100;
                scripts.forEach(s => {
                    const info = {
                        name: s.getAttribute('data-script-name'),
                        desc: s.querySelector('.script-description').textContent,
                        url: 'https://greasyfork.org/scripts/' + s.getAttribute('data-script-id'),
                        installs: s.getAttribute('data-script-total-installs')
                    };
                    const li = document.createElement('li');
                    li.style = "padding:12px 0; border-bottom:1px solid #eee;";
                    li.innerHTML = `<a href="${info.url}" target="_blank" style="font-weight:bold; color:#1e90ff; text-decoration:none;">${info.name}</a>
                                    <div class="sf-trans-name" style="display:none; font-size:12px; color:#d35400; padding:2px 0;"></div>
                                    <p style="font-size:13px; margin:5px 0;">${info.desc}</p>
                                    <div class="sf-trans-desc" style="display:none; font-size:12px; color:#d35400; padding:2px 0;"></div>
                                    <small style="color:#999;">📥 ${info.installs}</small>`;
                    panel.querySelector('.sf-info-list').appendChild(li);
                    
                    // 异步翻译挂载
                    queueTrans(info.name, li.querySelector('.sf-trans-name'), delay);
                    queueTrans(info.desc, li.querySelector('.sf-trans-desc'), delay + 50);
                    delay += 150;
                });
            }
        });
    }

    function queueTrans(text, el, ms) {
        if (!text || /[\u4e00-\u9fa5]/.test(text)) return;
        setTimeout(() => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
                onload: (res) => {
                    const d = JSON.parse(res.responseText);
                    const t = d[0].map(x => x[0]).join('');
                    if (t && el) { el.innerText = `🏮 ${t}`; el.style.display = 'block'; }
                }
            });
        }, ms);
    }
})();
