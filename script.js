let currentConfig = {};
let originalConfig = {};
let sourceStructure = null;
let isExternalConfigLoaded = false;

const TAB_META = {
    basic: {
        title: '基础设置',
        desc: '管理倒计时和星期显示等基础属性。'
    },
    subjects: {
        title: '科目名称',
        desc: '维护科目简写与全称映射，支持带下角标简写。'
    },
    timetable: {
        title: '时间表',
        desc: '配置不同类型日程的时间段与课程编号。'
    },
    daily: {
        title: '每日课表',
        desc: '设置一周每日课表与对应时间表类型。'
    },
    divider: {
        title: '分隔线',
        desc: '控制课表中的分隔线显示位置。'
    },
    style: {
        title: '样式配置',
        desc: '编辑导出配置中的 CSS 变量。'
    }
};

const DEFAULT_CSS_STYLE = {
    '--center-font-size': '35px',
    '--corner-font-size': '0px',
    '--countdown-font-size': '20px',
    '--global-border-radius': '20px',
    '--global-bg-opacity': '0.72',
    '--container-bg-padding': '8px 14px',
    '--countdown-bg-padding': '8px 12px',
    '--container-space': '12px',
    '--top-space': '4px',
    '--main-horizontal-space': '6px',
    '--divider-width': '2px',
    '--divider-margin': '4px',
    '--triangle-size': '10px',
    '--sub-font-size': '15px'
};

/** 初始化应用并挂载所有事件。 */
function initializeApp() {
    sourceStructure = createDefaultSourceStructure();

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    initializeNavigation();
    initializeSummaryShortcuts();
    initializeLiveSummarySync();
    resetConfig(false);
}

/** 创建源配置结构标记。 */
function createDefaultSourceStructure() {
    return {
        hasWeekDisplay: false
    };
}

/** 初始化导航并绑定选项卡切换逻辑。 */
function initializeNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            activateTab(tabId);
        });
    });
}

/** 初始化概览卡快捷跳转。 */
function initializeSummaryShortcuts() {
    document.querySelectorAll('[data-tab-shortcut]').forEach(card => {
        card.addEventListener('click', () => {
            const tabId = card.getAttribute('data-tab-shortcut');
            activateTab(tabId);
        });
    });
}

/** 初始化展示层的实时概览刷新。 */
function initializeLiveSummarySync() {
    document.addEventListener('input', handleLiveSummaryRefresh);
    document.addEventListener('change', handleLiveSummaryRefresh);
}

/** 在用户编辑关键区域时刷新概览信息。 */
function handleLiveSummaryRefresh(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    if (
        target.closest('#subjectsTable')
        || target.closest('#timetableTable')
        || target.closest('#dailyClasses')
        || target.closest('#styleTable')
        || target.id === 'countdown_target'
        || target.id === 'week_display'
    ) {
        refreshEditorOverview();
    }
}

/** 激活指定选项卡并同步顶部标题。 */
function activateTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    updateSectionHint(tabId);
}

/** 根据当前选项卡更新页面头部说明。 */
function updateSectionHint(tabId) {
    const titleElement = document.getElementById('activeSectionTitle');
    const descElement = document.getElementById('activeSectionDesc');
    const meta = TAB_META[tabId] || TAB_META.basic;

    if (titleElement) {
        titleElement.textContent = meta.title;
    }

    if (descElement) {
        descElement.textContent = meta.desc;
    }
}

/** 刷新侧栏状态与顶部概览数字。 */
function refreshEditorOverview() {
    setElementText('summarySubjectsCount', getSubjectCount());
    setElementText('summaryTimetableCount', getTimetableTypeCount());
    setElementText('summaryDailyCount', getDailyClassCount());
    setElementText('summaryStyleCount', getStyleVariableCount());
    updateConfigStatusBadge();
    updateConfigSummaryText();
}

/** 获取当前可见或已加载的科目数量。 */
function getSubjectCount() {
    const rows = Array.from(document.querySelectorAll('#subjectsTable tbody tr'));
    if (rows.length > 0) {
        return rows.filter(row => {
            const key = row.querySelector('.subject-key')?.value.trim() || '';
            const value = row.querySelector('.subject-value')?.value.trim() || '';
            return Boolean(key && value);
        }).length;
    }

    return Object.keys(currentConfig.subject_name || {}).length;
}

/** 获取当前时间表类型数量。 */
function getTimetableTypeCount() {
    return Object.keys(currentConfig.timetable || {}).length;
}

/** 获取当前每日课表卡片数量。 */
function getDailyClassCount() {
    const cards = document.querySelectorAll('.daily-class-card');
    if (cards.length > 0) {
        return cards.length;
    }

    return Array.isArray(currentConfig.daily_class) ? currentConfig.daily_class.length : 0;
}

/** 获取当前样式变量数量。 */
function getStyleVariableCount() {
    const rows = Array.from(document.querySelectorAll('#styleTable tbody tr'));
    if (rows.length > 0) {
        return rows.filter(row => {
            const key = row.querySelector('.style-key')?.value.trim() || '';
            const value = row.querySelector('.style-value')?.value.trim() || '';
            return Boolean(key && value);
        }).length;
    }

    return Object.keys(currentConfig.css_style || {}).length;
}

/** 更新配置来源状态标签。 */
function updateConfigStatusBadge() {
    const badge = document.getElementById('configSourceBadge');
    if (!badge) {
        return;
    }

    badge.textContent = isExternalConfigLoaded ? '已载入外部配置' : '默认配置';
    badge.classList.toggle('status-success', isExternalConfigLoaded);
    badge.classList.toggle('status-neutral', !isExternalConfigLoaded);
}

/** 更新侧栏中的配置摘要文案。 */
function updateConfigSummaryText() {
    const summary = document.getElementById('configSummaryText');
    if (!summary) {
        return;
    }

    summary.textContent = `科目 ${getSubjectCount()} 项 · 时间表 ${getTimetableTypeCount()} 类 · 每日课表 ${getDailyClassCount()} 天 · 样式变量 ${getStyleVariableCount()} 项`;
}

/** 为指定元素写入纯文本。 */
function setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = String(value);
    }
}

/** 构建默认配置对象。 */
function createDefaultConfig() {
    return {
        countdown_target: 'hidden',
        week_display: false,
        subject_name: {},
        timetable: {},
        divider: {},
        daily_class: [],
        css_style: { ...DEFAULT_CSS_STYLE }
    };
}

/** 深拷贝任意 JSON 可序列化对象。 */
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

/** 将输入配置规整为标准结构以提升格式兼容性。 */
function normalizeConfig(rawConfig) {
    const base = createDefaultConfig();
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};

    base.countdown_target = typeof source.countdown_target === 'string'
        ? source.countdown_target.trim() || 'hidden'
        : 'hidden';

    base.week_display = Boolean(source.week_display);

    if (source.subject_name && typeof source.subject_name === 'object' && !Array.isArray(source.subject_name)) {
        Object.entries(source.subject_name).forEach(([key, value]) => {
            const normalizedKey = String(key || '').trim();
            const normalizedValue = String(value || '').trim();
            if (normalizedKey && normalizedValue) {
                base.subject_name[normalizedKey] = normalizedValue;
            }
        });
    }

    base.timetable = normalizeTimetable(source.timetable);
    base.divider = normalizeDivider(source.divider);
    base.daily_class = normalizeDailyClass(source.daily_class);
    base.css_style = normalizeCssStyle(source.css_style);
    return base;
}

/** 规整时间表对象并统一时间段格式。 */
function normalizeTimetable(timetable) {
    const result = {};
    if (!timetable || typeof timetable !== 'object' || Array.isArray(timetable)) {
        return result;
    }

    Object.entries(timetable).forEach(([dayType, dayValue]) => {
        if (!dayValue || typeof dayValue !== 'object' || Array.isArray(dayValue)) {
            return;
        }

        const cleanedType = String(dayType || '').trim();
        if (!cleanedType) {
            return;
        }

        result[cleanedType] = {};

        Object.entries(dayValue).forEach(([timeRange, content]) => {
            const normalizedRange = normalizeTimeRange(timeRange);
            if (!normalizedRange) {
                return;
            }

            if (typeof content === 'number' && Number.isFinite(content)) {
                result[cleanedType][normalizedRange] = Math.trunc(content);
                return;
            }

            const text = String(content ?? '').trim();
            if (text === '') {
                return;
            }

            const numeric = Number(text);
            result[cleanedType][normalizedRange] = Number.isInteger(numeric) ? numeric : text;
        });
    });

    return result;
}

/** 标准化时间段文本为 HH:MM-HH:MM。 */
function normalizeTimeRange(rawRange) {
    const compact = String(rawRange ?? '')
        .replace(/[~～—–至]/g, '-')
        .replace(/\s+/g, '');

    const match = compact.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) {
        return '';
    }

    const normalizeTime = value => {
        const [hour, minute] = value.split(':');
        return `${hour.padStart(2, '0')}:${minute}`;
    };

    return `${normalizeTime(match[1])}-${normalizeTime(match[2])}`;
}

/** 规整分隔线配置并去重排序。 */
function normalizeDivider(divider) {
    const result = {};
    if (!divider || typeof divider !== 'object' || Array.isArray(divider)) {
        return result;
    }

    Object.entries(divider).forEach(([dayType, indexes]) => {
        const key = String(dayType || '').trim();
        if (!key || !Array.isArray(indexes)) {
            return;
        }

        const unique = new Set();
        indexes.forEach(value => {
            const num = Number(value);
            if (Number.isInteger(num) && num >= 0) {
                unique.add(num);
            }
        });

        result[key] = Array.from(unique).sort((a, b) => a - b);
    });

    return result;
}

/** 规整每日课表条目并兼容轮换课程格式。 */
function normalizeDailyClass(dailyClass) {
    if (!Array.isArray(dailyClass)) {
        return [];
    }

    return dailyClass
        .map(day => {
            const normalized = {
                Chinese: String(day?.Chinese ?? '').trim(),
                English: String(day?.English ?? '').trim(),
                classList: [],
                timetable: String(day?.timetable ?? '').trim()
            };

            const classList = Array.isArray(day?.classList) ? day.classList : [];
            classList.forEach(item => {
                const normalizedItem = normalizeClassItem(item);
                if (normalizedItem !== null) {
                    normalized.classList.push(normalizedItem);
                }
            });

            return normalized;
        })
        .filter(day => day.Chinese || day.English || day.classList.length > 0 || day.timetable);
}

/** 规整单个课程项，支持普通课程与轮换课程数组。 */
function normalizeClassItem(item) {
    if (Array.isArray(item)) {
        const rotated = item
            .map(sub => String(sub ?? '').trim())
            .filter(Boolean);
        return rotated.length > 0 ? rotated : null;
    }

    const value = String(item ?? '').trim();
    return value ? value : null;
}

/** 规整样式配置，确保键值均为字符串。 */
function normalizeCssStyle(cssStyle) {
    const normalized = { ...DEFAULT_CSS_STYLE };
    if (!cssStyle || typeof cssStyle !== 'object' || Array.isArray(cssStyle)) {
        return normalized;
    }

    Object.entries(cssStyle).forEach(([key, value]) => {
        const cssKey = String(key || '').trim();
        const cssValue = String(value ?? '').trim();
        if (cssKey && cssValue) {
            normalized[cssKey] = cssValue;
        }
    });

    return normalized;
}

/** 读取配置文件并导入到编辑器。 */
function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const content = String(e.target?.result || '');
            const parsedConfig = ConfigParser.parseJS(content);
            sourceStructure = detectSourceStructure(parsedConfig);
            currentConfig = normalizeConfig(parsedConfig);
            originalConfig = deepClone(currentConfig);
            isExternalConfigLoaded = true;
            loadConfigToUI();
            showNotification('配置文件加载成功。', 'success');
        } catch (error) {
            showNotification(`配置解析失败：${error.message}`, 'error');
        }
    };

    reader.readAsText(file);
    event.target.value = '';
}

/** 检测输入配置的原始结构特征。 */
function detectSourceStructure(config) {
    const structure = createDefaultSourceStructure();
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return structure;
    }

    structure.hasWeekDisplay = Object.prototype.hasOwnProperty.call(config, 'week_display');
    return structure;
}

/** 将当前配置数据回填到所有 UI 组件。 */
function loadConfigToUI() {
    document.getElementById('countdown_target').value = currentConfig.countdown_target || 'hidden';
    document.getElementById('week_display').checked = Boolean(currentConfig.week_display);
    syncWeekDisplayVisibility();

    loadSubjects();
    loadTimetableTypes();
    loadTimetableDay();
    loadDividerTypes();
    loadDividerDay();
    loadDailyClasses();
    loadStyles();
    refreshEditorOverview();
}

/** 根据源配置结构控制周显示开关可见性。 */
function syncWeekDisplayVisibility() {
    const group = document.getElementById('weekDisplayGroup');
    if (!group) {
        return;
    }

    group.style.display = sourceStructure?.hasWeekDisplay ? 'flex' : 'none';
}

/** 从基础设置区域同步配置。 */
function updateConfigFromUI() {
    currentConfig.countdown_target = document.getElementById('countdown_target').value.trim() || 'hidden';
    currentConfig.week_display = sourceStructure?.hasWeekDisplay
        ? document.getElementById('week_display').checked
        : false;
}

/** 重置编辑器为默认配置。 */
function resetConfig(showToast = true) {
    sourceStructure = createDefaultSourceStructure();
    currentConfig = createDefaultConfig();
    originalConfig = deepClone(currentConfig);
    isExternalConfigLoaded = false;
    loadConfigToUI();
    if (showToast) {
        showNotification('配置已重置。', 'warning');
    }
}

/** 导出当前配置并复制到剪贴板与下载文件。 */
async function exportConfig() {
    try {
        updateConfigFromUI();
        updateSubjectsFromUI();
        saveTimetableToConfig(false);
        updateDividerFromUI(false);
        updateDailyClassesFromUI();
        updateStylesFromUI();

        currentConfig = normalizeConfig(currentConfig);
        const exportPayload = buildExportConfig();
        const jsContent = ConfigParser.generateJS(exportPayload);
        const copied = await copyToClipboard(jsContent);
        downloadTextFile('scheduleConfig.js', jsContent);
        originalConfig = deepClone(currentConfig);

        if (copied) {
            showNotification('配置已导出并复制到剪贴板。', 'success');
            return;
        }

        showNotification('配置已导出，但复制到剪贴板失败。', 'warning');
    } catch (error) {
        showNotification(`导出失败：${error.message}`, 'error');
    }
}

/** 构建导出对象并保持与源配置结构一致。 */
function buildExportConfig() {
    const exportConfig = {
        countdown_target: currentConfig.countdown_target,
        subject_name: deepClone(currentConfig.subject_name || {}),
        timetable: deepClone(currentConfig.timetable || {}),
        divider: deepClone(currentConfig.divider || {}),
        daily_class: deepClone(currentConfig.daily_class || []),
        css_style: deepClone(currentConfig.css_style || {})
    };

    if (sourceStructure?.hasWeekDisplay) {
        exportConfig.week_display = Boolean(currentConfig.week_display);
        return {
            countdown_target: exportConfig.countdown_target,
            week_display: exportConfig.week_display,
            subject_name: exportConfig.subject_name,
            timetable: exportConfig.timetable,
            divider: exportConfig.divider,
            daily_class: exportConfig.daily_class,
            css_style: exportConfig.css_style
        };
    }

    return exportConfig;
}

/** 复制文本到剪贴板，兼容旧浏览器。 */
async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        return Boolean(document.execCommand('copy'));
    } catch (error) {
        return false;
    } finally {
        textArea.remove();
    }
}

/** 触发文本文件下载。 */
function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/** 渲染科目映射表。 */
function loadSubjects() {
    const tbody = document.querySelector('#subjectsTable tbody');
    tbody.innerHTML = '';

    Object.entries(currentConfig.subject_name || {}).forEach(([key, value]) => {
        addSubjectRow(key, value);
    });

    if (tbody.children.length === 0) {
        addSubjectRow();
    }
}

/** 添加科目映射行。 */
function addSubjectRow(key = '', value = '') {
    const tbody = document.querySelector('#subjectsTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${escapeHtml(key)}" class="subject-key" placeholder="如：数"></td>
        <td><input type="text" value="${escapeHtml(value)}" class="subject-value" placeholder="如：数学"></td>
        <td><button class="delete" onclick="this.closest('tr').remove()">删除</button></td>
    `;
    tbody.appendChild(row);
}

/** 从科目映射表回写数据。 */
function updateSubjectsFromUI() {
    const subjects = {};
    document.querySelectorAll('#subjectsTable tbody tr').forEach(row => {
        const key = row.querySelector('.subject-key')?.value.trim() || '';
        const value = row.querySelector('.subject-value')?.value.trim() || '';
        if (key && value) {
            subjects[key] = value;
        }
    });
    currentConfig.subject_name = subjects;
}

/** 重新加载时间表类型下拉框。 */
function loadTimetableTypes() {
    const select = document.getElementById('timetableDay');
    const selected = select.value;
    select.innerHTML = '<option value="">请选择或添加时间表类型</option>';

    Object.keys(currentConfig.timetable || {}).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });

    if (selected && currentConfig.timetable[selected]) {
        select.value = selected;
    }
}

/** 加载当前选中时间表类型的行数据。 */
function loadTimetableDay() {
    const dayType = document.getElementById('timetableDay').value;
    const tbody = document.querySelector('#timetableTable tbody');
    tbody.innerHTML = '';

    if (!dayType) {
        return;
    }

    const dayData = currentConfig.timetable?.[dayType] || {};
    Object.entries(dayData).forEach(([time, content]) => {
        addTimetableRow(time, content);
    });

    if (tbody.children.length === 0) {
        addTimetableRow();
    }
}

/** 添加时间表编辑行。 */
function addTimetableRow(time = '', content = '') {
    const tbody = document.querySelector('#timetableTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${escapeHtml(String(time))}" class="timetable-time" placeholder="08:00-08:39"></td>
        <td><input type="text" value="${escapeHtml(String(content))}" class="timetable-content" placeholder="课程序号或文本"></td>
        <td><button class="delete" onclick="this.closest('tr').remove()">删除</button></td>
    `;
    tbody.appendChild(row);
}

/** 解析时间表内容，支持数字与字符串。 */
function parseTimetableContent(rawValue) {
    const text = String(rawValue ?? '').trim();
    if (text === '') {
        return null;
    }

    const numeric = Number(text);
    return Number.isInteger(numeric) ? numeric : text;
}

/** 保存当前选中时间表类型内容。 */
function saveTimetableToConfig(showToast = true) {
    const dayType = document.getElementById('timetableDay').value;
    if (!dayType) {
        return;
    }

    const normalizedDayType = sanitizeTypeName(dayType);
    if (!normalizedDayType) {
        return;
    }

    const dayTable = {};
    document.querySelectorAll('#timetableTable tbody tr').forEach(row => {
        const rawTime = row.querySelector('.timetable-time')?.value;
        const rawContent = row.querySelector('.timetable-content')?.value;
        const normalizedTime = normalizeTimeRange(rawTime);
        const parsedContent = parseTimetableContent(rawContent);

        if (normalizedTime && parsedContent !== null) {
            dayTable[normalizedTime] = parsedContent;
        }
    });

    if (!currentConfig.timetable) {
        currentConfig.timetable = {};
    }
    currentConfig.timetable[normalizedDayType] = dayTable;

    if (normalizedDayType !== dayType) {
        delete currentConfig.timetable[dayType];
        loadTimetableTypes();
        document.getElementById('timetableDay').value = normalizedDayType;
    }

    if (showToast) {
        showNotification('时间表已保存。', 'success');
    }
}

/** 删除当前时间表类型。 */
function deleteTimetableDay() {
    const dayType = document.getElementById('timetableDay').value;
    if (!dayType) {
        return;
    }

    if (!window.confirm(`确定删除时间表类型“${dayType}”吗？`)) {
        return;
    }

    delete currentConfig.timetable[dayType];
    loadTimetableTypes();
    loadTimetableDay();
    loadDailyClasses();
    showNotification('时间表类型已删除。', 'success');
}

/** 新增时间表类型。 */
function addNewTimetableType() {
    const typeName = window.prompt('请输入新的时间表类型名称（如：workday、special）：');
    const normalized = sanitizeTypeName(typeName);
    if (!normalized) {
        return;
    }

    if (!currentConfig.timetable) {
        currentConfig.timetable = {};
    }

    if (!currentConfig.timetable[normalized]) {
        currentConfig.timetable[normalized] = {};
    }

    loadTimetableTypes();
    document.getElementById('timetableDay').value = normalized;
    loadTimetableDay();
    loadDailyClasses();
    showNotification('时间表类型已添加。', 'success');
}

/** 渲染每日课表卡片。 */
function loadDailyClasses() {
    const container = document.getElementById('dailyClasses');
    container.innerHTML = '';

    (currentConfig.daily_class || []).forEach((day, index) => {
        addDailyClassCard(day, index);
    });

    const addButton = document.createElement('button');
    addButton.id = 'addDailyButton';
    addButton.className = 'btn btn-primary btn-sm';
    addButton.textContent = '添加新天';
    addButton.onclick = addNewDay;
    container.appendChild(addButton);
}

/** 向页面添加单个每日课表卡片。 */
function addDailyClassCard(day, index) {
    const container = document.getElementById('dailyClasses');
    const card = document.createElement('div');
    card.className = 'daily-class-card';

    const timetableTypes = Object.keys(currentConfig.timetable || {});
    let timetableOptions = '<option value="">请选择时间表类型</option>';

    if (timetableTypes.length === 0) {
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'workday', 'weekend'].forEach(type => {
            const selected = day.timetable === type ? 'selected' : '';
            timetableOptions += `<option value="${type}" ${selected}>${type}</option>`;
        });
    } else {
        timetableTypes.forEach(type => {
            const selected = day.timetable === type ? 'selected' : '';
            timetableOptions += `<option value="${type}" ${selected}>${type}</option>`;
        });
    }

    card.innerHTML = `
        <div class="daily-class-header">
            <h3>第${index + 1}天</h3>
            <button class="delete" onclick="removeDailyClassCard(this)">删除</button>
        </div>
        <div class="daily-class-grid">
            <label>
                中文名
                <input type="text" class="chinese-name" value="${escapeHtml(day.Chinese || '')}" placeholder="如：一">
            </label>
            <label>
                英文名
                <input type="text" class="english-name" value="${escapeHtml(day.English || '')}" placeholder="如：MON">
            </label>
            <label>
                时间表类型
                <select class="timetable-type">${timetableOptions}</select>
            </label>
        </div>
        <div class="classlist-inputs"></div>
    `;

    const classListContainer = card.querySelector('.classlist-inputs');
    (day.classList || []).forEach(item => {
        createClassItemInput(classListContainer, Array.isArray(item) ? item.join(',') : String(item));
    });

    const addClassButton = document.createElement('button');
    addClassButton.className = 'btn btn-primary btn-sm';
    addClassButton.textContent = '添加课程';
    addClassButton.onclick = function () {
        addClassItem(this);
    };
    classListContainer.appendChild(addClassButton);

    const addButton = document.getElementById('addDailyButton');
    container.insertBefore(card, addButton || null);
}

/** 添加新的空白每日课表卡片。 */
function addNewDay() {
    addDailyClassCard({ Chinese: '', English: '', classList: [], timetable: '' }, document.querySelectorAll('.daily-class-card').length);
}

/** 删除每日课表卡片并刷新标题序号。 */
function removeDailyClassCard(button) {
    const card = button.closest('.daily-class-card');
    if (card) {
        card.remove();
        refreshDailyDayTitles();
    }
}

/** 更新每日课表卡片标题序号。 */
function refreshDailyDayTitles() {
    document.querySelectorAll('.daily-class-card').forEach((card, index) => {
        const title = card.querySelector('.daily-class-header h3');
        if (title) {
            title.textContent = `第${index + 1}天`;
        }
    });
}

/** 在每日课表卡片内添加课程输入框。 */
function addClassItem(button) {
    const classListContainer = button.parentElement;
    createClassItemInput(classListContainer, '');
}

/** 创建一个课程输入项并插入到容器。 */
function createClassItemInput(container, value) {
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'classlist-input';
    inputWrapper.innerHTML = `
        <input type="text" class="class-item" value="${escapeHtml(value)}" placeholder="轮换课用逗号分隔">
        <button class="delete" onclick="this.closest('.classlist-input').remove()">删除</button>
    `;
    const addButton = container.querySelector('.btn');
    container.insertBefore(inputWrapper, addButton || null);
}

/** 从每日课表区域回写数据。 */
function updateDailyClassesFromUI() {
    const dailyClasses = [];
    document.querySelectorAll('.daily-class-card').forEach(card => {
        const day = {
            Chinese: card.querySelector('.chinese-name')?.value.trim() || '',
            English: card.querySelector('.english-name')?.value.trim() || '',
            classList: [],
            timetable: card.querySelector('.timetable-type')?.value.trim() || ''
        };

        card.querySelectorAll('.class-item').forEach(input => {
            const parsed = parseClassInputValue(input.value);
            if (parsed !== null) {
                day.classList.push(parsed);
            }
        });

        if (day.Chinese || day.English || day.classList.length > 0 || day.timetable) {
            dailyClasses.push(day);
        }
    });

    currentConfig.daily_class = dailyClasses;
}

/** 解析课程输入值，支持字符串与轮换课程数组。 */
function parseClassInputValue(rawValue) {
    const text = String(rawValue ?? '').trim();
    if (!text) {
        return null;
    }

    const tokens = text
        .split(/[,，、]/)
        .map(token => token.trim())
        .filter(Boolean);

    if (tokens.length > 1) {
        return tokens;
    }

    return tokens[0] || null;
}

/** 重新加载分隔线类型下拉列表。 */
function loadDividerTypes() {
    const select = document.getElementById('dividerDay');
    const selected = select.value;
    select.innerHTML = '<option value="">请选择或添加分隔线类型</option>';

    Object.keys(currentConfig.divider || {}).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });

    if (selected && currentConfig.divider[selected]) {
        select.value = selected;
    }
}

/** 加载当前分隔线类型的编辑界面。 */
function loadDividerDay() {
    const dayType = document.getElementById('dividerDay').value;
    const container = document.getElementById('dividerInputs');

    if (!dayType) {
        container.innerHTML = '<div class="empty-state"><p>请先选择或添加分隔线类型</p></div>';
        return;
    }

    const values = currentConfig.divider?.[dayType] || [];
    container.innerHTML = `
        <div class="divider-actions">
            <label for="dividerDayName">类型名称</label>
            <input type="text" id="dividerDayName" value="${escapeHtml(dayType)}" readonly>
            <button class="btn btn-primary btn-sm" onclick="renameDividerDay()">重命名</button>
            <button class="btn btn-danger btn-sm" onclick="deleteDividerDay()">删除此类型</button>
        </div>
        <label>分隔线位置（课程序号）</label>
        <div class="divider-inputs-container">
            ${values.map(value => `<input type="number" class="divider-input" value="${value}" min="0">`).join('')}
        </div>
        <div class="divider-actions">
            <button class="btn btn-primary btn-sm" onclick="addDividerInput(this)">添加分隔线</button>
            <button class="btn btn-success btn-sm" onclick="updateDividerFromUI()">保存分隔线</button>
        </div>
    `;

    if (values.length === 0) {
        const inputContainer = container.querySelector('.divider-inputs-container');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'divider-input';
        input.min = '0';
        input.placeholder = '课程序号';
        inputContainer.appendChild(input);
    }
}

/** 在分隔线区域追加一个序号输入框。 */
function addDividerInput(button) {
    const parent = button.closest('#dividerInputs');
    const inputContainer = parent?.querySelector('.divider-inputs-container');
    if (!inputContainer) {
        return;
    }

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'divider-input';
    input.min = '0';
    input.placeholder = '课程序号';
    inputContainer.appendChild(input);
    input.focus();
}

/** 保存当前分隔线类型。 */
function updateDividerFromUI(showToast = true) {
    const dayType = document.getElementById('dividerDay').value;
    if (!dayType) {
        return;
    }

    const unique = new Set();
    document.querySelectorAll('.divider-input').forEach(input => {
        const value = Number(input.value);
        if (Number.isInteger(value) && value >= 0) {
            unique.add(value);
        }
    });

    if (!currentConfig.divider) {
        currentConfig.divider = {};
    }

    currentConfig.divider[dayType] = Array.from(unique).sort((a, b) => a - b);
    if (showToast) {
        showNotification('分隔线已保存。', 'success');
    }
}

/** 重命名分隔线类型。 */
function renameDividerDay() {
    const oldName = document.getElementById('dividerDay').value;
    if (!oldName) {
        return;
    }

    const newName = sanitizeTypeName(window.prompt('请输入新的分隔线类型名称：', oldName));
    if (!newName || newName === oldName) {
        return;
    }

    if (!currentConfig.divider) {
        currentConfig.divider = {};
    }

    if (currentConfig.divider[newName]) {
        showNotification('同名分隔线类型已存在。', 'warning');
        return;
    }

    currentConfig.divider[newName] = currentConfig.divider[oldName] || [];
    delete currentConfig.divider[oldName];
    loadDividerTypes();
    document.getElementById('dividerDay').value = newName;
    loadDividerDay();
    showNotification('分隔线类型已重命名。', 'success');
}

/** 删除当前分隔线类型。 */
function deleteDividerDay() {
    const dayType = document.getElementById('dividerDay').value;
    if (!dayType) {
        return;
    }

    if (!window.confirm(`确定删除分隔线类型“${dayType}”吗？`)) {
        return;
    }

    delete currentConfig.divider[dayType];
    loadDividerTypes();
    loadDividerDay();
    showNotification('分隔线类型已删除。', 'success');
}

/** 新增分隔线类型。 */
function addNewDividerType() {
    const typeName = sanitizeTypeName(window.prompt('请输入新的分隔线类型名称（如：workday、special）：'));
    if (!typeName) {
        return;
    }

    if (!currentConfig.divider) {
        currentConfig.divider = {};
    }

    if (!currentConfig.divider[typeName]) {
        currentConfig.divider[typeName] = [];
    }

    loadDividerTypes();
    document.getElementById('dividerDay').value = typeName;
    loadDividerDay();
    showNotification('分隔线类型已添加。', 'success');
}

/** 渲染样式变量表。 */
function loadStyles() {
    const tbody = document.querySelector('#styleTable tbody');
    tbody.innerHTML = '';

    Object.entries(currentConfig.css_style || {}).forEach(([key, value]) => {
        addStyleRow(key, value);
    });
}

/** 添加样式配置行。 */
function addStyleRow(key = '', value = '') {
    const tbody = document.querySelector('#styleTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${escapeHtml(key)}" class="style-key" placeholder="CSS变量名"></td>
        <td><input type="text" value="${escapeHtml(value)}" class="style-value" placeholder="CSS变量值"></td>
    `;
    tbody.appendChild(row);
}

/** 从样式变量表回写配置。 */
function updateStylesFromUI() {
    const styleObject = {};
    document.querySelectorAll('#styleTable tbody tr').forEach(row => {
        const key = row.querySelector('.style-key')?.value.trim() || '';
        const value = row.querySelector('.style-value')?.value.trim() || '';
        if (key && value) {
            styleObject[key] = value;
        }
    });

    currentConfig.css_style = {
        ...DEFAULT_CSS_STYLE,
        ...styleObject
    };
}

/** 清洗类型名称并移除非法字符。 */
function sanitizeTypeName(typeName) {
    const sanitized = String(typeName || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w\u4e00-\u9fa5-]/g, '');
    return sanitized;
}

/** 对字符串做 HTML 转义以防止注入。 */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 展示顶部通知消息。 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${escapeHtml(getNotificationIcon(type))}</span>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    document.body.appendChild(notification);

    window.setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 16);

    window.setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-8px)';
        window.setTimeout(() => notification.remove(), 240);
    }, 2600);
}

/** 根据通知类型返回图标字符。 */
function getNotificationIcon(type) {
    if (type === 'success') {
        return '✓';
    }
    if (type === 'error') {
        return '✕';
    }
    if (type === 'warning') {
        return '!';
    }
    return 'i';
}

document.addEventListener('DOMContentLoaded', initializeApp);
