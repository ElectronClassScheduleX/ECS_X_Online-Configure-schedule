let currentConfig = {};
let originalConfig = {};


document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    

    document.querySelectorAll('.nav-item').forEach(li => {
        li.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            
            const tab = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tab).classList.add('active');
        });
    });

    // 为开关添加点击事件监听
    const weekDisplayToggle = document.getElementById('week_display');
    if (weekDisplayToggle) {
        weekDisplayToggle.addEventListener('change', function() {
            console.log('显示星期开关状态:', this.checked);
        });
    }

    resetConfig();
});



function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        console.log('=== 文件上传调试信息 ===');
        console.log('文件大小:', content.length, '字符');
        
        try {
            let config;
            const errors = [];
            
            // 尝试解析
            try {
                console.log('开始解析...');
                config = ConfigParser.parseJS(content);
                console.log('解析成功:', Object.keys(config));
                console.log('timetable keys:', Object.keys(config.timetable || {}));
                console.log('divider keys:', Object.keys(config.divider || {}));
            } catch (error) {
                errors.push('解析失败: ' + error.message);
                console.error('解析错误:', error);
            }
            
            if (config) {
                currentConfig = config;
                originalConfig = JSON.parse(JSON.stringify(currentConfig));
                console.log('开始加载UI...');
                loadConfigToUI();
                showNotification('配置文件加载成功！', 'success');
            } else {
                throw new Error('解析失败:\n' + errors.join('\n'));
            }
            
        } catch (error) {
            console.error('=== 完全失败 ===');
            console.error('错误详情:', error);
            showNotification('配置文件解析失败：' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 重置配置 - 完全空白的默认配置
function resetConfig() {
    currentConfig = {
        countdown_target: 'hidden',
        week_display: false,
        subject_name: {},
        timetable: {},  
        divider: {},
        daily_class: [],
        css_style: {}
    };
    originalConfig = JSON.parse(JSON.stringify(currentConfig));
    loadConfigToUI();
    showNotification('配置已重置', 'warning');
}


function loadConfigToUI() {
    try {
        document.getElementById('countdown_target').value = currentConfig.countdown_target || 'hidden';
        document.getElementById('week_display').checked = currentConfig.week_display || false;
        
        loadSubjects();
        
        loadTimetableTypes();
        loadTimetableDay();
        
        loadDividerTypes();
        loadDividerDay();
        
        setTimeout(() => {
            loadDailyClasses();
        }, 100);
        
        loadStyles();
        
        console.log('配置加载完成');
    } catch (error) {
        console.error('加载UI失败:', error);
    }
}
 
function exportConfig() {
    try {
        updateConfigFromUI();
        updateSubjectsFromUI();
        saveTimetableToConfig();
        updateDividerFromUI();
        updateDailyClassesFromUI();
        
        const jsContent = ConfigParser.generateJS(currentConfig);
        
        const textArea = document.createElement('textarea');
        textArea.value = jsContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const blob = new Blob([jsContent], { type: 'text/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scheduleConfig.js';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('配置已导出！文件已下载，如果被阻止，请检查浏览器的下载区域。配置内容也已复制到剪贴板。', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showNotification('导出失败：' + error.message, 'error');
    }
}

function updateStylesFromUI() {
    const styles = {};
    document.querySelectorAll('#styleTable tbody tr').forEach(row => {
        const key = row.cells[0].textContent;
        const value = row.querySelector('.style-value').value;
        if (key && value) {
            styles[key] = value;
        }
    });
    currentConfig.css_style = styles;
}

// 更新配置从UI
function updateConfigFromUI() {
    currentConfig.countdown_target = document.getElementById('countdown_target').value;
    currentConfig.week_display = document.getElementById('week_display').checked;
}

// === 科目名称相关 ===
function loadSubjects() {
    const tbody = document.querySelector('#subjectsTable tbody');
    tbody.innerHTML = '';
    
    for (const [key, value] of Object.entries(currentConfig.subject_name || {})) {
        addSubjectRow(key, value);
    }
}

function addSubjectRow(key = '', value = '') {
    const tbody = document.querySelector('#subjectsTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${key}" class="subject-key"></td>
        <td><input type="text" value="${value}" class="subject-value"></td>
        <td><button class="delete" onclick="this.closest('tr').remove()">删除</button></td>
    `;
    tbody.appendChild(row);
}

function updateSubjectsFromUI() {
    const subjects = {};
    document.querySelectorAll('#subjectsTable tbody tr').forEach(row => {
        const key = row.querySelector('.subject-key').value;
        const value = row.querySelector('.subject-value').value;
        if (key && value) {
            subjects[key] = value;
        }
    });
    currentConfig.subject_name = subjects;
}

function loadTimetableTypes() {
    const select = document.getElementById('timetableDay');
    const currentValue = select.value; // 保存当前选择
    
    // 清空并添加默认选项
    select.innerHTML = '<option value="">请选择或添加时间表类型</option>';
    
    const timetable = currentConfig.timetable || {};
    Object.keys(timetable).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
    
    // 如果之前有选择，尝试恢复选择
    if (currentValue && timetable[currentValue] !== undefined) {
        select.value = currentValue;
    }
}

// === 时间表相关 ===
function loadTimetableDay() {
    const day = document.getElementById('timetableDay').value;
    const tbody = document.querySelector('#timetableTable tbody');
    tbody.innerHTML = '';
    
    if (!day) return;
    
    const timetable = currentConfig.timetable || {};
    const dayData = timetable[day] || {};
    
    console.log('加载时间表:', day, dayData);
    
    for (const [time, content] of Object.entries(dayData)) {
        // 处理内容显示（数字显示为数字，字符串显示为字符串）
        const displayContent = typeof content === 'number' ? content : content;
        addTimetableRow(time, displayContent);
    }
}


function addTimetableRow(time = '', content = '') {
    const tbody = document.querySelector('#timetableTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${time}" class="timetable-time" placeholder="08:00-08:39"></td>
        <td><input type="text" value="${content}" class="timetable-content" placeholder="科目序号或文字"></td>
        <td><button class="delete" onclick="this.closest('tr').remove()">删除</button></td>
    `;
    tbody.appendChild(row);
}

function saveTimetableToConfig() {
    const day = document.getElementById('timetableDay').value;
    if (!day) return;
    
    const timetable = {};
    
    document.querySelectorAll('#timetableTable tbody tr').forEach(row => {
        const time = row.querySelector('.timetable-time').value;
        const content = row.querySelector('.timetable-content').value;
        if (time && content) {
            // 尝试转换为数字，如果不是数字则保持字符串
            const parsedContent = isNaN(content) || content.trim() === '' ? content : parseInt(content);
            timetable[time] = parsedContent;
        }
    });
    
    if (!currentConfig.timetable) currentConfig.timetable = {};
    currentConfig.timetable[day] = timetable;
    showNotification('时间表已保存', 'success');
}

function deleteTimetableDay() {
    const day = document.getElementById('timetableDay').value;
    if (!day) return;
    
    if (confirm(`确定要删除 "${day}" 类型的时间表配置吗？`)) {
        if (currentConfig.timetable && currentConfig.timetable[day]) {
            delete currentConfig.timetable[day];
        }
        loadTimetableTypes();
        loadTimetableDay();
        showNotification('删除成功！', 'success');
    }
}

// === 每日课表相关 ===
function loadDailyClasses() {
    const container = document.getElementById('dailyClasses');
    container.innerHTML = '';
    
    (currentConfig.daily_class || []).forEach((day, index) => {
        addDailyClassCard(day, index);
    });
    
    // 添加新天按钮
    const addButton = document.createElement('button');
    addButton.textContent = '添加新天';
    addButton.className = 'btn btn-primary btn-sm';
    addButton.onclick = addNewDay;
    container.appendChild(addButton);
}

function addDailyClassCard(day, index) {
    const container = document.getElementById('dailyClasses');
    
    // 生成动态的时间表类型选项
    const timetableTypes = Object.keys(currentConfig.timetable || {});
    let timetableOptions = '<option value="">请选择时间表类型</option>';
    
    if (timetableTypes.length === 0) {
        // 如果没有时间表类型，使用默认选项
        timetableOptions = `
            <option value="mon">星期一</option>
            <option value="tue">星期二</option>
            <option value="wed">星期三</option>
            <option value="thu">星期四</option>
            <option value="fri">星期五</option>
            <option value="sat">星期六</option>
            <option value="sun">星期日</option>
            <option value="workday">工作日</option>
            <option value="weekend">周末</option>
        `;
    } else {
        // 使用用户定义的时间表类型
        timetableTypes.forEach(type => {
            const selected = day.timetable === type ? 'selected' : '';
            timetableOptions += `<option value="${type}" ${selected}>${type}</option>`;
        });
    }
    
    const card = document.createElement('div');
    card.className = 'daily-class-card';
    card.innerHTML = `
        <div class="daily-class-header">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                第${index + 1}天
            </h3>
            <button class="delete" onclick="this.closest('.daily-class-card').remove()">删除</button>
        </div>
        <div>
            <label>中文名: <input type="text" value="${day.Chinese || ''}" class="chinese-name"></label>
            <label>英文名: <input type="text" value="${day.English || ''}" class="english-name"></label>
            <label>时间表类型: 
                <select class="timetable-type">
                    ${timetableOptions}
                </select>
            </label>
        </div>
        <div class="classlist-inputs">
            ${(day.classList || []).map(cls => {
                if (Array.isArray(cls)) {
                    // 处理轮换课
                    return `
                        <div class="classlist-input">
                            <input type="text" value="${cls.join(',')}" class="class-item" placeholder="多个科目用逗号分隔">
                            <button class="delete" onclick="this.closest('.classlist-input').remove()">×</button>
                        </div>
                    `;
                } else {
                    // 处理普通课程
                    return `
                        <div class="classlist-input">
                            <input type="text" value="${cls}" class="class-item" placeholder="科目简写">
                            <button class="delete" onclick="this.closest('.classlist-input').remove()">×</button>
                        </div>
                    `;
                }
            }).join('')}
            <button class="btn btn-primary btn-sm" onclick="addClassItem(this)">添加课程</button>
        </div>
    `;
    container.insertBefore(card, container.lastChild);
}


function addNewDay() {
    const newDay = {
        Chinese: '',
        English: '',
        classList: [],
        timetable: ''
    };
    addDailyClassCard(newDay, document.querySelectorAll('.daily-class-card').length);
}

function addClassItem(button) {
    const container = button.parentElement;
    const inputDiv = document.createElement('div');
    inputDiv.className = 'classlist-input';
    inputDiv.innerHTML = `
        <input type="text" class="class-item" placeholder="科目简写（轮换课用逗号分隔）">
        <button class="delete" onclick="this.closest('.classlist-input').remove()">×</button>
    `;
    container.insertBefore(inputDiv, button);
}

// 更新每日课表从UI
function updateDailyClassesFromUI() {
    const cards = document.querySelectorAll('.daily-class-card');
    const dailyClasses = [];
    
    cards.forEach(card => {
        // 跳过添加按钮
        if (card.querySelector('.daily-class-header h3') && 
            card.querySelector('.daily-class-header h3').textContent.includes('添加新天')) {
            return;
        }
        
        // 跳过没有内容的卡片
        if (!card.querySelector('.chinese-name')) {
            return;
        }
        
        const day = {
            Chinese: card.querySelector('.chinese-name')?.value || '',
            English: card.querySelector('.english-name')?.value || '',
            classList: [],
            timetable: card.querySelector('.timetable-type')?.value || ''
        };
        
        // 处理课程列表
        const classInputs = card.querySelectorAll('.class-item');
        classInputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                // 如果包含逗号，认为是轮换课
                if (value.includes(',')) {
                    day.classList.push(value.split(',').map(v => v.trim()));
                } else {
                    day.classList.push(value);
                }
            }
        });
        
        dailyClasses.push(day);
    });
    
    currentConfig.daily_class = dailyClasses;
}

function loadDividerTypes() {
    const select = document.getElementById('dividerDay');
    const currentValue = select.value; // 保存当前选择
    
    // 清空并添加默认选项
    select.innerHTML = '<option value="">请选择或添加分隔线类型</option>';
    
    const divider = currentConfig.divider || {};
    Object.keys(divider).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
    
    // 如果之前有选择，尝试恢复选择
    if (currentValue && divider[currentValue] !== undefined) {
        select.value = currentValue;
    }
}
// === 分隔线相关 ===
function loadDividerDay() {
    const day = document.getElementById('dividerDay').value;
    const container = document.getElementById('dividerInputs');
    
    if (!day) {
        container.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg><p>请先选择或添加分隔线类型</p></div>';
        return;
    }
    
    const divider = currentConfig.divider || {};
    const dayData = divider[day] || [];
    
    console.log('加载分隔线:', day, dayData);
    
    container.innerHTML = `
        <div class="divider-actions">
            <label>类型名称:</label>
            <input type="text" id="dividerDayName" value="${day}" readonly>
            <button class="btn btn-primary btn-sm" onclick="renameDividerDay()">重命名</button>
            <button class="btn btn-danger btn-sm" onclick="deleteDividerDay()">删除此类型</button>
        </div>
        <label>分隔线位置（课程序号）:</label>
        <div class="divider-inputs-container">
            ${dayData.map((num, index) => `
                <input type="number" value="${num}" class="divider-input" data-index="${index}" style="width: 80px; margin: 5px;">
            `).join('')}
        </div>
        <div class="divider-actions">
            <button class="btn btn-primary btn-sm" onclick="addDividerInput(this)">添加分隔线</button>
            <button class="btn btn-success btn-sm" onclick="updateDividerFromUI()">保存分隔线</button>
        </div>
    `;
}

function addDividerInput(button) {
    const container = button.parentElement;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'divider-input';
    input.placeholder = '课程序号';
    input.style.width = '80px';
    input.style.margin = '5px';
    container.insertBefore(input, button);
}

function updateDividerFromUI() {
    const day = document.getElementById('dividerDay').value;
    if (!day) return;
    
    const inputs = document.querySelectorAll('.divider-input');
    const values = Array.from(inputs)
        .map(input => parseInt(input.value))
        .filter(val => !isNaN(val));
    
    if (!currentConfig.divider) currentConfig.divider = {};
    currentConfig.divider[day] = values;
    showNotification('分隔线已保存', 'success');
}

function renameDividerDay() {
    const oldName = document.getElementById('dividerDay').value;
    const newName = prompt('请输入新的类型名称：', oldName);
    
    if (newName && newName.trim() && newName.trim() !== oldName) {
        const trimmedName = newName.trim();
        
        if (!currentConfig.divider) currentConfig.divider = {};
        
        // 移动数据
        if (currentConfig.divider[oldName]) {
            currentConfig.divider[trimmedName] = currentConfig.divider[oldName];
            delete currentConfig.divider[oldName];
        }
        
        // 更新下拉框
        loadDividerTypes();
        document.getElementById('dividerDay').value = trimmedName;
        loadDividerDay();
        showNotification('重命名成功！', 'success');
    }
}

function deleteDividerDay() {
    const day = document.getElementById('dividerDay').value;
    if (!day) return;
    
    if (confirm(`确定要删除 "${day}" 类型的分隔线配置吗？`)) {
        if (currentConfig.divider && currentConfig.divider[day]) {
            delete currentConfig.divider[day];
        }
        loadDividerTypes();
        document.getElementById('dividerInputs').innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg><p>请先选择或添加分隔线类型</p></div>';
        showNotification('删除成功！', 'success');
    }
}

function addNewTimetableType() {
    const typeName = prompt('请输入新的时间表类型名称（如：myday, special 等）：');
    if (typeName && typeName.trim()) {
        const trimmedName = typeName.trim();
        
        // 初始化该类型的时间表为空对象
        if (!currentConfig.timetable) currentConfig.timetable = {};
        if (!currentConfig.timetable[trimmedName]) {
            currentConfig.timetable[trimmedName] = {};
        }
        
        // 更新下拉框
        loadTimetableTypes();
        document.getElementById('timetableDay').value = trimmedName;
        loadTimetableDay();
        showNotification('时间表类型已添加', 'success');
    }
}

function addNewDividerType() {
    const typeName = prompt('请输入新的分隔线类型名称（如：myday, special 等）：');
    if (typeName && typeName.trim()) {
        const trimmedName = typeName.trim();
        
        // 初始化该类型的分隔线为空数组
        if (!currentConfig.divider) currentConfig.divider = {};
        if (!currentConfig.divider[trimmedName]) {
            currentConfig.divider[trimmedName] = [];
        }
        
        // 更新下拉框
        loadDividerTypes();
        document.getElementById('dividerDay').value = trimmedName;
        loadDividerDay();
        showNotification('分隔线类型已添加', 'success');
    }
}

function loadStyles() {
    const tbody = document.querySelector('#styleTable tbody');
    tbody.innerHTML = '';
    
    for (const [key, value] of Object.entries(currentConfig.css_style || {})) {
        addStyleRow(key, value);
    }
}

function addStyleRow(key = '', value = '') {
    const tbody = document.querySelector('#styleTable tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" value="${key}" class="style-key" placeholder="CSS属性"></td>
        <td><input type="text" value="${value}" class="style-value" placeholder="CSS值"></td>
    `;
    tbody.appendChild(row);
}

function updateStylesFromUI() {
    const styles = {};
    document.querySelectorAll('#styleTable tbody tr').forEach(row => {
        const key = row.querySelector('.style-key').value;
        const value = row.querySelector('.style-value').value;
        if (key && value) {
            styles[key] = value;
        }
    });
    currentConfig.css_style = styles;
}
