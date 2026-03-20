// ==UserScript==
// @name            Script Finder+
// @name:zh-CN      Script Finder 油猴脚本查找
// @description:zh-CN 修复桌面端靠右显示逻辑。手机竖版“查找”不遮挡。渲染优先、异步翻译、支持拖动、位置记录。
// @namespace       https://github.com/HHXXYY123/script-finder-plus
// @version         2026.3.21.7
// @author          HHXXYY123
// @match           *://*/*
// @connect         greasyfork.org
// @connect         translate.googleapis.com
// @grant           GM_xmlhttpRequest
// @grant           GM_addStyle
// @license         MIT
// ==/UserScript==

(function () {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const userLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
    const isChinese = userLang.startsWith('zh')
    
    const getT = (key) => {
        const dict = isChinese ? {
            Author: '作者', Installs: '安装量', Loading: '加载中...', LoadMore: '加载更多', AllLoaded: '到底啦',
            Search: '搜索脚本...', Scripts: '脚本查找', MiniBtn: '查找', Timeout: '超时'
        } : {
            Author: 'Author', Installs: 'Installs', Loading: 'Loading...', LoadMore: 'More', AllLoaded: 'End',
            Search: 'Search...', Scripts: 'Scripts', MiniBtn: 'Find', Timeout: 'Timeout'
        }
        return dict[key] || key
    }

    const domain = window.location.hostname.split('.').slice(-2).join('.')
    let neverLoaded = true, collapsed = true, loadedPages = 0, hideTimer = null, isDragging = false

    function queueTranslation(text, element, delay) {
        if (!text || /[\u4e00-\u9fa5]/.test(text)) return
        setTimeout(() => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
                timeout: 8000,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText)
                        const translated = data[0].map(x => x[0]).join('')
                        if (translated && element) {
                            element.style.display = 'block'
                            element.innerText = `🏮 ${translated}`
                        }
                    } catch (e) {}
                }
            })
        }, delay)
    }

    function getScriptsInfo(domain, page = 1) {
        const btn = document.querySelector('.sf-load-more'), hint = document.querySelector('.sf-wait-loading')
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&page=${page}`,
            timeout: 10000,
            onload: (res) => {
                hint.style.display = 'none'
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html')
                const scripts = doc.querySelector('#browse-script-list')?.querySelectorAll('[data-script-id]')
                if (page === 1) {
                    const totalText = doc.querySelector('.sidebar-redesign p, #main-header p')?.innerText || ''
                    const match = totalText.match(/(\d+)/)
                    if (match) document.querySelector('.sf-total-count').innerText = ` (${match[0]})`
                }
                if (!scripts || scripts.length === 0) {
                    if (page === 1) { hint.innerText = "该域暂无可用脚本"; hint.style.display = 'block' }
                    return
                }
                let staggerDelay = 100
                scripts.forEach(s => {
                    const info = {
                        id: s.getAttribute('data-script-id'), name: s.getAttribute('data-script-name'),
                        author: s.querySelector('dd.script-list-author').textContent,
                        desc: s.querySelector('.script-description').textContent,
                        version: s.getAttribute('data-script-version'),
                        url: 'https://greasyfork.org/scripts/' + s.getAttribute('data-script-id'),
                        installs: s.getAttribute('data-script-total-installs'),
                        rating: s.getAttribute('data-script-rating-score')
                    }
                    const li = appendItem(info)
                    queueTranslation(info.name, li.querySelector('.sf-trans-name'), staggerDelay)
                    queueTranslation(info.desc, li.querySelector('.sf-trans-desc'), staggerDelay + 50)
                    staggerDelay += 150 
                })
                const next = doc.querySelector('.next_page')
                if (!next || next.classList.contains('disabled')) {
                    loadedPages = 'max'; btn.textContent = getT('AllLoaded'); btn.disabled = true
                } else {
                    loadedPages = page; btn.style.display = 'block'; btn.textContent = getT('LoadMore')
                }
            },
            ontimeout: () => { hint.innerText = getT('Timeout'); hint.style.display = 'block' }
        })
    }

    function appendItem(s) {
        const list = document.querySelector('.sf-info-list')
        const li = document.createElement('li')
        li.className = 'sf-info-item'; li.style = "border-bottom: 1px solid #eee; padding: 12px 0; list-style: none;"
        li.innerHTML = `
            <div class="sf-item-card">
                <a class="sf-name" href="${s.url}" target="_blank" style="font-size:16px; font-weight:bold; color:#1e90ff; text-decoration:none;">${s.name}</a>
                <div class="sf-trans-name" style="display:none; font-size:13px; color:#d35400; background:#fff5eb; padding:3px 6px; border-radius:4px; margin:4px 0;"></div>
                <p class="sf-desc" style="font-size:13px; color:#444; margin:6px 0; line-height:1.4;">${s.desc}</p>
                <div class="sf-trans-desc" style="display:none; font-size:13px; color:#d35400; background:#fff5eb; padding:3px 6px; border-radius:4px; margin:4px 0;"></div>
                <div style="display:flex; gap:10px; font-size:12px; color:#888;">
                    <span>👤 ${s.author}</span><span>📥 ${s.installs}</span>
                </div>
            </div>`
        list.appendChild(li); return li
    }

    function setupUI() {
        GM_addStyle(`
            scrbutton.sf-main-btn {
                position: fixed; right: 10px; padding: 10px 18px; font-size: 16px; font-weight: bold;
                border: none; border-radius: 30px; background: #1e90ff; color: #fff; cursor: grab; z-index: 999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2); opacity: 0; display: none; transition: opacity 0.4s;
                user-select: none; touch-action: none;
            }
            @media screen and (max-width: 768px) {
                scrbutton.sf-main-btn {
                    padding: 10px 6px; font-size: 13px; width: 28px; line-height: 1.2; 
                    border-radius: 8px; right: 5px; text-align: center;
                    word-break: break-all; display: flex; align-items: center; justify-content: center;
                }
            }
            div.sf-panel {
                display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 95%; max-width: 650px; background: #fff; border-radius: 12px; z-index: 1000000;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4); padding: 15px; max-height: 80vh; overflow-y: auto;
            }
            @media (prefers-color-scheme: dark) {
                div.sf-panel { background: #222; color: #ddd; }
                .sf-desc { color: #bbb !important; }
                .sf-trans-name, .sf-trans-desc { background: #3a2a1a !important; color: #ff9900 !important; }
            }
        `)

        const button = document.createElement('scrbutton'), panel = document.createElement('div')
        button.className = 'sf-main-btn'
        button.innerText = isMobile ? getT('MiniBtn') : getT('Scripts')
        document.body.appendChild(button)

        const savedPos = localStorage.getItem('sf-btn-top')
        button.style.top = savedPos ? savedPos + 'px' : '70%'

        panel.className = 'sf-panel'; panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:8px;">
                <div style="font-size:18px; font-weight:bold; color:#1e90ff;">Script Finder<span class="sf-total-count" style="font-size:12px; color:#999;"></span></div>
                <button class="sf-close" style="border:none; background:none; cursor:pointer; font-size:24px; color:#999;">&times;</button>
            </div>
            <input type="text" class="sf-search" placeholder="${getT('Search')}" style="width:100%; padding:10px; margin:10px 0; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;">
            <div class="sf-wait-loading" style="text-align:center; padding:20px;">${getT('Loading')}</div>
            <ul class="sf-info-list" style="padding:0; margin:0;"></ul>
            <button class="sf-load-more" style="display:none; width:100%; padding:10px; background:#1e90ff; color:#fff; border:none; border-radius:4px; margin-top:10px;">${getT('LoadMore')}</button>
        `
        document.body.appendChild(panel)

        let startY, startTop, moveDist = 0
        const onStart = (e) => {
            isDragging = true; moveDist = 0; button.style.transition = 'none'
            const cy = e.touches ? e.touches[0].clientY : e.clientY
            startY = cy; startTop = button.offsetTop; clearTimeout(hideTimer)
        }
        const onMove = (e) => {
            if (!isDragging) return
            if (e.cancelable) e.preventDefault()
            const cy = e.touches ? e.touches[0].clientY : e.clientY
            const dy = cy - startY; moveDist = Math.abs(dy)
            const nt = Math.max(10, Math.min(startTop + dy, window.innerHeight - 60))
            button.style.top = nt + 'px'; localStorage.setItem('sf-btn-top', nt)
        }
        const onEnd = () => { if (!isDragging) return; isDragging = false; button.style.transition = 'opacity 0.4s'; if (collapsed) startTimer() }

        button.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd)
        button.addEventListener('touchstart', onStart, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onEnd)

        const startTimer = (d = 2000) => { 
            clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (collapsed && !isDragging) { button.style.opacity = '0'; setTimeout(() => { if (button.style.opacity === '0') button.style.display = 'none' }, 400) } }, d) 
        }
        const showBtn = (d = 2000) => { button.style.display = 'flex'; setTimeout(() => button.style.opacity = '0.9', 10); if (collapsed && !isDragging) startTimer(d) }

        // --- 核心修复：鼠标靠右自动显示 ---
        window.addEventListener('mousemove', (e) => {
            if (collapsed && e.clientX > window.innerWidth - 50) showBtn(3000)
        })

        window.addEventListener('scroll', () => { if (collapsed) showBtn() })
        document.addEventListener('mousedown', (e) => { if (!collapsed && !panel.contains(e.target) && !button.contains(e.target)) closePanel() })

        const closePanel = () => { panel.style.display = 'none'; collapsed = true; startTimer() }
        button.onclick = () => {
            if (moveDist > 5) return
            if (collapsed) { panel.style.display = 'block'; if (neverLoaded) { getScriptsInfo(domain); neverLoaded = false }; collapsed = false; clearTimeout(hideTimer) }
            else closePanel()
        }
        panel.querySelector('.sf-close').onclick = closePanel
        panel.querySelector('.sf-search').oninput = (e) => {
            const v = e.target.value.toLowerCase()
            panel.querySelectorAll('.sf-info-item').forEach(li => li.style.display = li.innerText.toLowerCase().includes(v) ? 'block' : 'none')
        }
        panel.querySelector('.sf-load-more').onclick = () => { if (loadedPages !== 'max') getScriptsInfo(domain, loadedPages + 1) }
        showBtn(4000)
    }

    if (document.readyState === 'complete') setupUI(); else window.addEventListener('load', setupUI)
})()
