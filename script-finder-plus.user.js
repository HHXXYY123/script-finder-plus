// ==UserScript==
// @name            Script Finder+
// @name:zh-CN      Script Finder 油猴脚本查找
// @description:zh-CN 模仿置顶按钮逻辑：随滚动/鼠标扫过唤醒，2秒自动隐藏。电脑端胶囊版，手机端竖版“查找”。
// @namespace       https://github.com/HHXXYY123/script-finder-plus
// @version         2026.3.21.10
// @author          HHXXYY123
// @match           *://*/*
// @connect         greasyfork.org
// @connect         translate.googleapis.com
// @grant           GM_xmlhttpRequest
// @grant           GM_addStyle
// @run-at          document-start
// @license         MIT
// ==/UserScript==

(function () {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const domain = window.location.hostname.split('.').slice(-2).join('.');
    let neverLoaded = true, collapsed = true, hideTimer = null, isDragging = false, moveDist = 0;

    // --- 1. 样式表 (严格隔离 PC/手机 UI) ---
    GM_addStyle(`
        #sf-main-btn {
            position: fixed; right: 14px; background-color: #1e90ff; color: white;
            font-weight: bold; border: none; cursor: pointer; z-index: 2147483647;
            box-shadow: 0 3px 6px rgba(0,0,0,0.2); opacity: 0; display: none;
            transition: opacity 0.2s ease-in-out; user-select: none; touch-action: none;
        }
        /* 电脑端：蓝色胶囊，文字横排 */
        @media screen and (min-width: 769px) {
            #sf-main-btn { padding: 10px 20px; font-size: 15px; border-radius: 30px; }
        }
        /* 手机端：窄条竖版，文字竖排 */
        @media screen and (max-width: 768px) {
            #sf-main-btn {
                padding: 10px 5px; font-size: 13px; width: 28px; line-height: 1.2;
                border-radius: 6px; right: 10px; text-align: center;
                display: flex; align-items: center; justify-content: center; word-break: break-all;
            }
        }
        #sf-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 95%; max-width: 650px; background: white; border-radius: 12px; z-index: 2147483647;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5); padding: 15px; max-height: 85vh; overflow-y: auto; color: #333;
        }
    `);

    // --- 2. 创建 UI ---
    const button = document.createElement('div');
    const panel = document.createElement('div');
    button.id = 'sf-main-btn';
    button.innerText = isMobile ? "查找" : "脚本查找";
    panel.id = 'sf-panel';

    // 模仿置顶脚本的快速注入
    const injectUI = () => {
        if (document.body && !document.getElementById('sf-main-btn')) {
            document.body.appendChild(button);
            document.body.appendChild(panel);
            button.style.top = localStorage.getItem('sf-btn-top') || '70%';
        }
    };
    const checkTimer = setInterval(() => { if(document.body) { injectUI(); clearInterval(checkTimer); } }, 50);

    // --- 3. 核心：显示/隐藏逻辑 (完全同步置顶按钮逻辑) ---
    const showBtn = (duration = 2000) => {
        if (!collapsed || isDragging) return;
        clearTimeout(hideTimer);
        button.style.display = isMobile ? 'flex' : 'block';
        // 强制重绘以确保 transition 生效
        button.getBoundingClientRect();
        button.style.opacity = '0.9';

        hideTimer = setTimeout(() => {
            if (collapsed && !isDragging) {
                button.style.opacity = '0';
                setTimeout(() => { if(button.style.opacity === '0') button.style.display = 'none'; }, 200);
            }
        }, duration);
    };

    // 滚动监测
    window.addEventListener('scroll', () => showBtn(2000), { passive: true });

    // 鼠标靠右监测 (雷达范围加大到 100px 确保稳定)
    window.addEventListener('mousemove', (e) => {
        if (collapsed && e.clientX > window.innerWidth - 100) showBtn(2000);
    }, true);

    // --- 4. 交互逻辑 (拖动与点击) ---
    let startY = 0, startTop = 0;
    const onStart = (e) => {
        isDragging = true; moveDist = 0; button.style.transition = 'none';
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startTop = button.offsetTop; clearTimeout(hideTimer);
    };
    const onMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dy = cy - startY; moveDist = Math.abs(dy);
        const nt = Math.max(10, Math.min(startTop + dy, window.innerHeight - 80));
        button.style.top = nt + 'px';
    };
    const onEnd = () => {
        if (!isDragging) return; isDragging = false;
        button.style.transition = 'opacity 0.2s ease-in-out';
        localStorage.setItem('sf-btn-top', button.offsetTop);
        showBtn(2000);
    };

    button.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    button.addEventListener('touchstart', onStart, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onEnd);

    button.onclick = () => {
        if (moveDist > 5) return;
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:10px; margin-bottom:10px;">
                <b style="color:#1e90ff; font-size:18px;">脚本查找器</b>
                <button id="sf-close-panel" style="border:none; background:none; font-size:24px; cursor:pointer; color:#999;">&times;</button>
            </div>
            <div id="sf-list-content">正在载入 GreasyFork 数据...</div>
        `;
        panel.style.display = 'block';
        collapsed = false;
        document.getElementById('sf-close-panel').onclick = () => { panel.style.display = 'none'; collapsed = true; showBtn(2000); };
        if (neverLoaded) { fetchScripts(); neverLoaded = false; }
    };

    // --- 5. 数据获取 ---
    function fetchScripts() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated`,
            onload: (res) => {
                const list = document.getElementById('sf-list-content');
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                const scripts = doc.querySelectorAll('#browse-script-list [data-script-id]');
                if (!scripts.length) { list.innerText = "本页面暂无适配脚本"; return; }
                list.innerHTML = '<ul style="padding:0; margin:0; list-style:none;"></ul>';
                const ul = list.querySelector('ul');
                scripts.forEach(s => {
                    const li = document.createElement('li');
                    li.style = "padding:12px 0; border-bottom:1px solid #eee;";
                    li.innerHTML = `<a href="https://greasyfork.org/scripts/${s.getAttribute('data-script-id')}" target="_blank" style="font-weight:bold; color:#1e90ff; text-decoration:none; font-size:15px;">${s.getAttribute('data-script-name')}</a>
                                    <p style="font-size:13px; color:#666; margin:5px 0;">${s.querySelector('.script-description').textContent}</p>`;
                    ul.appendChild(li);
                });
            }
        });
    }
})();
