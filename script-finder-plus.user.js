// ==UserScript==
// @name            Script Finder+ (Stable & Persistent)
// @name:zh-CN        Script Finder 油猴脚本查找
// @description:zh-CN 记录位置、自动翻译、点击外部关闭、新用户引导、全数据展示。
// @namespace         https://github.com/HHXXYY123/script-finder-plus
// @version           2026.3.21.2
// @author            HHXXYY123 二改至shiquda & 人民的勤务员
// @match             *://*/*
// @connect           greasyfork.org
// @connect           translate.googleapis.com
// @grant             GM_xmlhttpRequest
// @grant             GM_addStyle
// @license           MIT
// ==/UserScript==

(function () {
    const userLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
    const isChinese = userLang.startsWith('zh')
    const getT = (key) => {
        const dict = isChinese ? {
            Author: '作者', Installs: '总安装量', Daily: '今日安装', Created: '创建日期', Updated: '最后更新',
            Loading: '正在加载脚本...', LoadMore: '加载更多', AllLoaded: '没有更多了',
            Search: '搜索脚本名称或描述...', Scripts: '脚本查找', Total: '本站脚本总数'
        } : {
            Author: 'Author', Installs: 'Installs', Daily: 'Daily', Created: 'Created', Updated: 'Updated',
            Loading: 'Loading...', LoadMore: 'Load more', AllLoaded: 'All loaded',
            Search: 'Search...', Scripts: 'Scripts', Total: 'Total Scripts'
        }
        return dict[key] || key
    }

    const domain = window.location.hostname.split('.').slice(-2).join('.')
    let neverLoaded = true, collapsed = true, loadedPages = 0, hideTimer = null, isDragging = false

    // --- 翻译函数 (Google Translate API) ---
    async function translateText(text, element) {
        if (!text || /[\u4e00-\u9fa5]/.test(text)) return
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
            onload: (res) => {
                try {
                    const data = JSON.parse(res.responseText)
                    const translated = data[0].map(x => x[0]).join('')
                    if (translated && element) {
                        element.style.display = 'block'
                        element.innerText = `🏮 ${translated}`
                    }
                } catch (e) { }
            }
        })
    }

    function getScriptsInfo(domain, page = 1) {
        const btn = document.querySelector('.sf-load-more'), hint = document.querySelector('.sf-wait-loading')
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://greasyfork.org/scripts/by-site/${domain}?filter_locale=0&sort=updated&page=${page}`,
            onload: (res) => {
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html')
                const scripts = doc.querySelector('#browse-script-list')?.querySelectorAll('[data-script-id]')

                if (page === 1) {
                    const totalText = doc.querySelector('.sidebar-redesign p, #main-header p')?.innerText || ''
                    const match = totalText.match(/(\d+)/)
                    if (match) document.querySelector('.sf-total-count').innerText = ` (${match[0]})`
                }

                hint.style.display = 'none'
                if (!scripts || scripts.length === 0) {
                    if (page === 1) hint.innerText = "该域暂无可用的脚本"; hint.style.display = 'block'
                    return
                }

                scripts.forEach(s => {
                    const info = {
                        id: s.getAttribute('data-script-id'),
                        name: s.getAttribute('data-script-name'),
                        author: s.querySelector('dd.script-list-author').textContent,
                        desc: s.querySelector('.script-description').textContent,
                        version: s.getAttribute('data-script-version'),
                        url: 'https://greasyfork.org/scripts/' + s.getAttribute('data-script-id'),
                        installs: s.getAttribute('data-script-total-installs'),
                        daily: s.getAttribute('data-script-daily-installs'),
                        created: s.getAttribute('data-script-created-date'),
                        updated: s.getAttribute('data-script-updated-date'),
                        rating: s.getAttribute('data-script-rating-score')
                    }
                    appendItem(info)
                })

                const next = doc.querySelector('.next_page')
                if (!next || next.classList.contains('disabled')) {
                    loadedPages = 'max'; btn.textContent = getT('AllLoaded'); btn.disabled = true
                } else {
                    loadedPages = page; btn.style.display = 'block'; btn.textContent = getT('LoadMore'); btn.disabled = false
                }
            }
        })
    }

    function appendItem(s) {
        const list = document.querySelector('.sf-info-list')
        const li = document.createElement('li')
        li.className = 'sf-info-item'
        li.style = "border-bottom: 1px solid #eee; padding: 15px 0; list-style: none;"
        li.innerHTML = `
            <div class="sf-item-card">
                <a class="sf-name" href="${s.url}" target="_blank" style="font-size:18px; font-weight:bold; color:#1e90ff; text-decoration:none;">${s.name}</a>
                <div class="sf-trans-name" style="display:none; font-size:14px; color:#d35400; background:#fff5eb; padding:4px 8px; border-radius:4px; margin:4px 0;"></div>
                <p class="sf-desc" style="font-size:15px; color:#444; margin:8px 0; line-height:1.5;">${s.desc}</p>
                <div class="sf-trans-desc" style="display:none; font-size:14px; color:#d35400; background:#fff5eb; padding:4px 8px; border-radius:4px; margin:4px 0;"></div>
                <div class="sf-meta-grid" style="display:flex; flex-wrap:wrap; gap:12px; font-size:14px; color:#666;">
                    <span>👤 ${s.author}</span>
                    <span>📥 ${s.installs} (${getT('Daily')}: ${s.daily})</span>
                    <span>⭐ ${s.rating}</span>
                </div>
                <div class="sf-meta-grid" style="margin-top:5px; color:#888; font-size:13px;">
                    <span>📅 ${getT('Created')}: ${s.created}</span>
                    <span style="margin-left:10px;">🔄 ${getT('Updated')}: ${s.updated}</span>
                </div>
                <a class="sf-ins-btn" href="https://greasyfork.org/scripts/${s.id}/code/script.user.js" style="display:inline-block; margin-top:10px; background:#28a745; color:#fff; padding:6px 15px; border-radius:4px; text-decoration:none; font-weight:bold;">安装 v${s.version}</a>
            </div>`
        list.appendChild(li)

        // 异步翻译，不阻塞 UI
        translateText(s.name, li.querySelector('.sf-trans-name'))
        translateText(s.desc, li.querySelector('.sf-trans-desc'))
    }

    function setupUI() {
        GM_addStyle(`
            scrbutton.sf-main-btn {
                position: fixed; right: 15px; padding: 12px 22px; font-size: 16px; font-weight: bold;
                border: none; border-radius: 50px; background: #1e90ff; color: #fff; cursor: grab; z-index: 999999;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); opacity: 0; display: none; transition: opacity 0.4s;
            }
            div.sf-panel {
                display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 90%; max-width: 750px; background: #fff; border-radius: 12px; z-index: 1000000;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5); padding: 20px; max-height: 85vh; overflow-y: auto;
            }
            @media (prefers-color-scheme: dark) {
                div.sf-panel { background: #1e1e1e; color: #eee; }
                .sf-desc { color: #ccc !important; }
                .sf-trans-name, .sf-trans-desc { background: #332211 !important; color: #ffa500 !important; }
            }
        `)

        const button = document.createElement('scrbutton'), panel = document.createElement('div')
        button.className = 'sf-main-btn'; button.innerText = getT('Scripts'); document.body.appendChild(button)

        // 读取记忆位置
        const savedPos = localStorage.getItem('sf-btn-top')
        button.style.top = savedPos ? savedPos + 'px' : '70%'

        panel.className = 'sf-panel'; panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e90ff; padding-bottom:10px;">
                <div style="font-size:22px; font-weight:bold; color:#1e90ff;">Script Finder<span class="sf-total-count" style="font-size:14px; color:#999; font-weight:normal;"></span></div>
                <button class="sf-close" style="border:none; background:none; cursor:pointer; font-size:28px; color:#999;">&times;</button>
            </div>
            <input type="text" class="sf-search" placeholder="${getT('Search')}" style="width:100%; padding:12px; margin:15px 0; border:1px solid #ddd; border-radius:8px; font-size:16px;">
            <div class="sf-wait-loading" style="text-align:center; padding:20px; font-size:16px;">${getT('Loading')}</div>
            <ul class="sf-info-list" style="padding:0; margin:0;"></ul>
            <button class="sf-load-more" style="display:none; width:100%; padding:12px; background:#1e90ff; color:#fff; border:none; border-radius:6px; cursor:pointer; margin-top:10px;">${getT('LoadMore')}</button>
        `
        document.body.appendChild(panel)

        // --- 逻辑：位置持久化与显示控制 ---
        let startY, startTop, moveDist = 0
        button.onmousedown = (e) => { isDragging = true; startY = e.clientY; startTop = button.offsetTop; moveDist = 0; button.style.transition = 'none'; clearTimeout(hideTimer) }
        window.onmousemove = (e) => {
            if (!isDragging) return
            const dy = e.clientY - startY; moveDist = Math.abs(dy)
            const newTop = Math.max(10, Math.min(startTop + dy, window.innerHeight - 50))
            button.style.top = newTop + 'px'
            localStorage.setItem('sf-btn-top', newTop) // 实时记录位置
        }
        window.onmouseup = () => { if (!isDragging) return; isDragging = false; button.style.transition = 'opacity 0.4s'; if (collapsed) startTimer() }

        const showBtn = (delay = 2000) => {
            button.style.display = 'block'; setTimeout(() => button.style.opacity = '0.9', 10)
            if (collapsed && !isDragging) startTimer(delay)
        }
        const startTimer = (delay = 2000) => {
            clearTimeout(hideTimer)
            hideTimer = setTimeout(() => { if (collapsed && !isDragging) { button.style.opacity = '0'; setTimeout(() => { if (button.style.opacity === '0') button.style.display = 'none' }, 400) } }, delay)
        }

        window.addEventListener('scroll', () => { if (collapsed) showBtn() })
        window.addEventListener('mousemove', (e) => { if (e.clientX > window.innerWidth - 60) showBtn() })

        // --- 逻辑：点击面板外关闭 ---
        document.addEventListener('mousedown', (e) => {
            if (!collapsed && !panel.contains(e.target) && !button.contains(e.target)) closePanel()
        })

        const closePanel = () => { panel.style.display = 'none'; collapsed = true; startTimer() }
        button.onclick = () => {
            if (moveDist > 5) return
            if (collapsed) { panel.style.display = 'block'; if (neverLoaded) { getScriptsInfo(domain); neverLoaded = false }; collapsed = false; clearTimeout(hideTimer) }
            else closePanel()
        }
        panel.querySelector('.sf-close').onclick = closePanel

        // 搜索过滤
        const sInput = panel.querySelector('.sf-search')
        sInput.oninput = () => {
            const v = sInput.value.toLowerCase()
            panel.querySelectorAll('.sf-info-item').forEach(li => li.style.display = li.innerText.toLowerCase().includes(v) ? 'block' : 'none')
        }
        panel.querySelector('.sf-load-more').onclick = () => { if (loadedPages !== 'max') getScriptsInfo(domain, loadedPages + 1) }

        // --- 引导：网页加载后出现 4 秒再消失 ---
        showBtn(4000)
    }

    if (document.readyState === 'complete') setupUI(); else window.addEventListener('load', setupUI)
})()
