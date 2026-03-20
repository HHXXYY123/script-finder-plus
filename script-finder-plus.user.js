// ==UserScript==
// @name            Script Finder+
// @name:zh-CN      Script Finder 油猴脚本查找
// @description:zh-CN 彻底修复按钮不显示问题。完全同步置顶按钮的注入逻辑。2秒闪现，电脑胶囊版，手机竖排版。
// @namespace       https://github.com/HHXXYY123/script-finder-plus
// @version         2026.3.21.11
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
    let neverLoaded = true, collapsed = true, hideTimer = null, isDragging = false;

    // --- 1. 样式注入 (参考置顶脚本，直接塞进 head) ---
    const style = document.createElement('style');
    style.innerHTML = `
        #sf-main-btn {
            position: fixed; right: 14px; background-color: #1e90ff !important; color: white !important;
            font-weight: bold !important; border: none !important; cursor: pointer !important; z-index: 99999999 !important;
            box-shadow: 0 3px 6px rgba(0,0,0,0.3) !important; opacity: 0; display: none;
            transition: opacity 0.2s ease-in-out !important; user-select: none !important;
        }
        @media screen and (min-width: 769px) {
            #sf-main-btn { padding: 10px 20px !important; font-size: 15px !important; border-radius: 30px !important; }
        }
        @media screen and (max-width: 768px) {
            #sf-main-btn {
                padding: 10px 5px !important; font-size: 13px !important; width: 28px !important; line-height: 1.2 !important;
                border-radius: 6px !important; right: 10px !important; text-align: center !important;
                display: flex !important; align-items: center !important; justify-content: center !important; word-break: break-all !important;
            }
        }
        #sf-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 95%; max-width: 650px; background: white; border-radius: 12px; z-index: 999999999;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5); padding: 15px; max-height: 85vh; overflow-y: auto; color: #333;
        }
    `;
    document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);

    // --- 2. 创建元素 ---
    const button = document.createElement('div');
    button.id = 'sf-main-btn';
    button.innerText = isMobile ? "查找" : "脚本查找";
    
    const panel = document.createElement('div');
    panel.id = 'sf-panel';

    // --- 3. 核心注入逻辑 (暴力轮询，直到成功) ---
    const tryInject = () => {
        if (document.body && !document.getElementById('sf-main-btn')) {
            document.body.appendChild(button);
            document.body.appendChild(panel);
            button.style.top = localStorage.getItem('sf-btn-top') || '70%';
            showBtn(2000); // 初始化闪现
            return true;
        }
        return false;
    };

    // 启动即刻尝试
    tryInject();
    // 哪怕还没加载完，只要 DOM 变动就尝试注入
    const observer = new MutationObserver(() => { if (tryInject()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // --- 4. 显示隐藏逻辑 (2秒闪现) ---
    function showBtn(duration = 2000) {
        if (!collapsed || isDragging) return;
        clearTimeout(hideTimer);
        button.style.display = isMobile ? 'flex' : 'block';
        setTimeout(() => { button.style.opacity = '0.9'; }, 10);

        hideTimer = setTimeout(() => {
            if (collapsed && !isDragging) {
                button.style.opacity = '0';
                setTimeout(() => { if(button.style.opacity === '0') button.style.display = 'none'; }, 200);
            }
        }, duration);
    }

    // 滚动触发
    window.addEventListener('scroll', () => showBtn(1800), { passive: true });

    // 雷达触发 (右侧 100px)
    window.addEventListener('mousemove', (e) => {
        if (collapsed && e.clientX > window.innerWidth - 100) showBtn(2000);
    }, true);

    // --- 5. 交互 (点击与拖动) ---
    let startY = 0, startTop = 0, moveDist = 0;
    const onStart = (e) => {
        isDragging = true; moveDist = 0; button.style.transition = 'none';
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startTop = button.offsetTop; clearTimeout(hideTimer);
    };
    const onMove = (e) => {
        if (!isDragging) return;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dy = cy - startY; moveDist = Math.abs(dy);
        button.style.top = Math.max(10, Math.min(startTop + dy, window.innerHeight - 80)) + 'px';
    };
    const onEnd = () => {
        if (!isDragging) return; isDragging = false;
        button.style.transition = 'opacity 0.2s ease-in-out';
        localStorage.setItem('sf-btn-top', button.style.top);
        showBtn(2000);
    };

    button.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    button.addEventListener('touchstart', onStart, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onEnd);

    button.onclick = () => {
        if (moveDist > 5) return;
        panel.style.display = 'block'; collapsed = false;
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:10px; margin-bottom:10px;">
                <b style="color:#1e90ff; font-size:18px;">脚本查找器</b>
                <button id="sf-close-p" style="border:none; background:none; font-size:24px; cursor:pointer; color:#999;">&times;</button>
            </div>
            <div id="sf-content">正在载入数据...</div>`;
        document.getElementById('sf-close-p').onclick = () => { panel.style.display = 'none'; collapsed = true; showBtn(2000); };
        if (neverLoaded) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated`,
                onload: (res) => {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const scripts = doc.querySelectorAll('#browse-script-list [data-script-id]');
                    const cont = document.getElementById('sf-content');
                    if (!scripts.length) { cont.innerText = "未发现可用脚本"; return; }
                    cont.innerHTML = "";
                    scripts.forEach(s => {
                        const div = document.createElement('div');
                        div.style = "padding:10px 0; border-bottom:1px solid #eee;";
                        div.innerHTML = `<a href="https://greasyfork.org/scripts/${s.getAttribute('data-script-id')}" target="_blank" style="font-weight:bold; color:#1e90ff; text-decoration:none;">${s.getAttribute('data-script-name')}</a>
                                         <p style="font-size:12px; color:#666; margin:4px 0;">${s.querySelector('.script-description').textContent}</p>`;
                        cont.appendChild(div);
                    });
                }
            });
            neverLoaded = false;
        }
    };
})();
