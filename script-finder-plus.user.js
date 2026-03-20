// ==UserScript==
// @name            Script Finder+
// @name:zh-CN      Script Finder 油猴脚本查找
// @description:zh-CN 电脑端恢复原样，手机端严格竖排“查找”。2秒闪现，极致雷达触发。
// @namespace       https://github.com/HHXXYY123/script-finder-plus
// @version         2026.3.21.9
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
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const domain = window.location.hostname.split('.').slice(-2).join('.')
    let neverLoaded = true, collapsed = true, hideTimer = null, isDragging = false, moveDist = 0

    // --- 样式：严格区分 PC 和 移动端 ---
    GM_addStyle(`
        scrbutton.sf-main-btn {
            position: fixed; right: 15px; background: #1e90ff; color: #fff; 
            font-weight: bold; border: none; cursor: grab; z-index: 2147483647;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); opacity: 0; display: none; 
            transition: opacity 0.3s; user-select: none; touch-action: none;
        }
        /* 电脑端：恢复原来的胶囊形状 */
        @media screen and (min-width: 769px) {
            scrbutton.sf-main-btn {
                padding: 12px 22px; font-size: 16px; border-radius: 50px;
            }
        }
        /* 手机端：严格竖排“查找” */
        @media screen and (max-width: 768px) {
            scrbutton.sf-main-btn {
                padding: 10px 6px; font-size: 13px; width: 28px; line-height: 1.2; 
                border-radius: 8px; right: 5px; text-align: center;
                display: flex; align-items: center; justify-content: center;
                word-break: break-all;
            }
        }
        div.sf-panel {
            display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 95%; max-width: 650px; background: #fff; border-radius: 12px; z-index: 2147483647;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5); padding: 15px; max-height: 85vh; overflow-y: auto; color: #333;
        }
    `);

    const button = document.createElement('scrbutton')
    const panel = document.createElement('div')
    button.className = 'sf-main-btn'
    // 严格按要求设置文字
    button.innerText = isMobile ? "查找" : "脚本查找"

    const showBtn = (duration = 2000) => {
        if (!collapsed || isDragging) return
        clearTimeout(hideTimer)
        button.style.display = isMobile ? 'flex' : 'inline-block'
        setTimeout(() => button.style.opacity = '0.9', 10)
        hideTimer = setTimeout(() => {
            if (collapsed && !isDragging) {
                button.style.opacity = '0'
                setTimeout(() => { if(button.style.opacity === '0') button.style.display = 'none' }, 300)
            }
        }, duration)
    }

    const init = () => {
        if (!document.body || document.querySelector('.sf-main-btn')) return
        document.body.appendChild(button)
        document.body.appendChild(panel)
        button.style.top = localStorage.getItem('sf-btn-top') || '70%'
        showBtn(2000)
    }
    const check = setInterval(() => { if(document.body) { init(); clearInterval(check) } }, 50)

    // --- 极速触发逻辑 ---
    window.addEventListener('mousemove', (e) => {
        if (e.clientX > window.innerWidth - 80) showBtn(2000)
    }, true)
    window.addEventListener('scroll', () => showBtn(2000), { passive: true })

    // --- 拖动逻辑 ---
    let startY = 0, startTop = 0
    const onStart = (e) => {
        isDragging = true; moveDist = 0; button.style.transition = 'none'
        startY = e.touches ? e.touches[0].clientY : e.clientY
        startTop = button.offsetTop; clearTimeout(hideTimer)
    }
    const onMove = (e) => {
        if (!isDragging) return
        if (e.cancelable) e.preventDefault()
        const cy = e.touches ? e.touches[0].clientY : e.clientY
        const dy = cy - startY; moveDist = Math.abs(dy)
        const nt = Math.max(10, Math.min(startTop + dy, window.innerHeight - 60))
        button.style.top = nt + 'px'
    }
    const onEnd = () => {
        if (!isDragging) return; isDragging = false
        button.style.transition = 'opacity 0.3s'
        localStorage.setItem('sf-btn-top', button.style.top)
        showBtn(2000)
    }

    button.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd)
    button.addEventListener('touchstart', onStart, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onEnd)

    button.onclick = () => {
        if (moveDist > 5) return
        panel.style.display = 'block'; collapsed = false
        if (neverLoaded) { fetchScripts(); neverLoaded = false }
    }

    // 面板部分省略（保持之前的功能）...
    panel.className = 'sf-panel'; panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:10px;">
            <b style="font-size:18px; color:#1e90ff;">Script Finder</b>
            <button class="sf-close" style="border:none; background:none; cursor:pointer; font-size:24px; color:#999;">&times;</button>
        </div>
        <div class="sf-wait-loading" style="text-align:center; padding:20px;">加载中...</div>
        <ul class="sf-info-list" style="padding:0; margin:0; list-style:none;"></ul>
    `;
    panel.querySelector('.sf-close').onclick = () => { panel.style.display = 'none'; collapsed = true; showBtn(2000) }

    function fetchScripts() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated`,
            onload: (res) => {
                panel.querySelector('.sf-wait-loading').style.display = 'none'
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html')
                const scripts = doc.querySelectorAll('#browse-script-list [data-script-id]')
                scripts.forEach(s => {
                    const li = document.createElement('li')
                    li.style = "padding:10px 0; border-bottom:1px solid #eee;"
                    li.innerHTML = `<a href="https://greasyfork.org/scripts/${s.getAttribute('data-script-id')}" target="_blank" style="font-weight:bold; color:#1e90ff; text-decoration:none;">${s.getAttribute('data-script-name')}</a><p style="font-size:12px;margin:4px 0">${s.querySelector('.script-description').textContent}</p>`
                    panel.querySelector('.sf-info-list').appendChild(li)
                })
            }
        })
    }
})()
