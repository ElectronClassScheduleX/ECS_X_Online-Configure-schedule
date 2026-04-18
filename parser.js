class ConfigParser {
    static ROOT_FIELD_ORDER = [
        'countdown_target',
        'week_display',
        'subject_name',
        'timetable',
        'divider',
        'daily_class',
        'css_style'
    ];

    static ROOT_FIELD_COMMENTS = {
        countdown_target: [
            '倒计时目标：位于右侧框中的倒计时，输入日期即可，可以是中考高考期末等等，格式YYYY-MM-DD',
            "若想隐藏右侧的倒计时，请在下方冒号后填入'hidden', (包括引号)"
        ],
        week_display: [
            '显示星期：控制左侧是否显示当前星期文本',
            '若配置文件包含该字段，将按布尔值导出'
        ],
        subject_name: [
            '科目名称：所有课程科目的简写及其对应全称，冒号前面(key)为简写，后面(value)为全称，不限字数，',
            "若存在多个课程简写相同，需要加以区分，可以为简写添加下角标，使用@分隔，如'自@语'，@前为简写，@后为下角标",
            '要求必须做到覆盖完全，否则可能会保错'
        ],
        timetable: [
            "时间表: 每天课程安排的时间表，内层冒号前面为时间，后面为课程序号(从0开始的数字[不带'']) 或 课间具体名称(用''包裹中间写文字)",
            "注：时间段中-后的时间要减一分钟 比如某节课40分钟，时间段为08:00-08:40，但实际配置时要配置'08:00-08:39'"
        ],
        divider: [
            '分隔线: 课表中区分不同时段课程的分隔线配置，外层key（冒号前）部分与上面timeable相同',
            "value（冒号后）为分隔线所在位置的前一个课程序号(从0开始的数字[不带''])"
        ],
        daily_class: [
            '从classList后最外的中括号看起，里面的第几个元素的序号-1就是该元素的下标，这个下标对应你在上面timetable中配置的数字，课程用单引号包含，写入在subject_name中配置的简写',
            "如果该节课可能存在每周轮换，你可以用一个中括号把他们全部写进去如: ['(第一周课)物', '(第二周)化', '(第三周)地', '(第四周)数'](小括号及其内容无需填写, 最多支持四周轮换)",
            "下面的timetable中配置该日属于在上面的timetable中的哪一类，如周日属于weekend就这样写 timetable: 'weekend'，用单引号包含"
        ],
        css_style: [
            '课表样式: 配置课表样式CSS变量, 包括字体大小，透明度等属性',
            "请不要更改冒号前半部分文字, 请更改冒号后单引号中的数字(切勿删除引号与数字后的单位)",
            '如果你对CSS有所了解你也可以尝试更改CSS单位'
        ]
    };

    static STYLE_FIELD_ORDER = [
        '--center-font-size',
        '--corner-font-size',
        '--countdown-font-size',
        '--global-border-radius',
        '--global-bg-opacity',
        '--container-bg-padding',
        '--countdown-bg-padding',
        '--container-space',
        '--top-space',
        '--main-horizontal-space',
        '--divider-width',
        '--divider-margin',
        '--triangle-size',
        '--sub-font-size'
    ];

    static STYLE_FIELD_COMMENTS = {
        '--center-font-size': '中间课表中的课程简写单字的字体大小',
        '--corner-font-size': '左侧的星期中文角标与右侧的"天"字的字体大小',
        '--countdown-font-size': '课程或课间全称与倒计时的字体大小 (需比--center-font-size少15单位)',
        '--global-border-radius': '所有背景框的圆角大小',
        '--global-bg-opacity': '所有背景框的不透明度, 范围: [0, 1]',
        '--container-bg-padding': '上面三个框各自的背景内边距, 前面的数字表示纵向边距，后面的数字表示横向边距',
        '--countdown-bg-padding': '倒计时框的背景内边距, 前面的数字表示纵向边距，后面的数字表示横向边距',
        '--container-space': '上面三个框中间的间隔长度',
        '--top-space': '课表主体最顶端与电脑屏幕上边框的间隔长度',
        '--main-horizontal-space': '中间课表中的课程简写单字之间的间隔长度',
        '--divider-width': '分隔线宽度',
        '--divider-margin': '分隔线外边距',
        '--triangle-size': '倒计时框上方小三角箭头的大小',
        '--sub-font-size': '中间课表中的课程下角标(X@X)的字体大小'
    };

    /** 解析 JS 配置文本并返回配置对象。 */
    static parseJS(content) {
        const configLiteral = this.extractConfigLiteral(content);
        const literalWithoutComments = this.stripComments(configLiteral);
        const normalizedLiteral = this.normalizeLiteral(literalWithoutComments);
        const parsed = this.evaluateLiteral(normalizedLiteral);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('配置对象格式无效');
        }

        return parsed;
    }

    /** 从脚本文本中提取 _scheduleConfig 的对象字面量。 */
    static extractConfigLiteral(content) {
        const markers = [
            'const _scheduleConfig',
            'let _scheduleConfig',
            'var _scheduleConfig',
            'const scheduleConfig',
            'let scheduleConfig',
            'var scheduleConfig'
        ];

        let markerIndex = -1;
        for (const marker of markers) {
            markerIndex = content.indexOf(marker);
            if (markerIndex !== -1) {
                break;
            }
        }

        if (markerIndex === -1) {
            throw new Error('未找到配置对象声明');
        }

        const braceStart = content.indexOf('{', markerIndex);
        if (braceStart === -1) {
            throw new Error('未找到配置对象起始符号');
        }

        const braceEnd = this.findMatchingBrace(content, braceStart);
        return content.slice(braceStart, braceEnd + 1);
    }

    /** 查找与起始花括号匹配的结束位置，忽略字符串和注释内部括号。 */
    static findMatchingBrace(text, startIndex) {
        let depth = 0;
        let inSingle = false;
        let inDouble = false;
        let inTemplate = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = startIndex; i < text.length; i += 1) {
            const current = text[i];
            const next = text[i + 1];

            if (inLineComment) {
                if (current === '\n') {
                    inLineComment = false;
                }
                continue;
            }

            if (inBlockComment) {
                if (current === '*' && next === '/') {
                    inBlockComment = false;
                    i += 1;
                }
                continue;
            }

            if (inSingle) {
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '\'') {
                    inSingle = false;
                }
                escaped = false;
                continue;
            }

            if (inDouble) {
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '"') {
                    inDouble = false;
                }
                escaped = false;
                continue;
            }

            if (inTemplate) {
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '`') {
                    inTemplate = false;
                }
                escaped = false;
                continue;
            }

            if (current === '/' && next === '/') {
                inLineComment = true;
                i += 1;
                continue;
            }

            if (current === '/' && next === '*') {
                inBlockComment = true;
                i += 1;
                continue;
            }

            if (current === '\'') {
                inSingle = true;
                continue;
            }

            if (current === '"') {
                inDouble = true;
                continue;
            }

            if (current === '`') {
                inTemplate = true;
                continue;
            }

            if (current === '{') {
                depth += 1;
                continue;
            }

            if (current === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
        }

        throw new Error('配置对象括号不匹配');
    }

    /** 删除对象字面量中的注释并保留字符串文本。 */
    static stripComments(literal) {
        let output = '';
        let inSingle = false;
        let inDouble = false;
        let inTemplate = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = 0; i < literal.length; i += 1) {
            const current = literal[i];
            const next = literal[i + 1];

            if (inLineComment) {
                if (current === '\n') {
                    inLineComment = false;
                    output += current;
                }
                continue;
            }

            if (inBlockComment) {
                if (current === '*' && next === '/') {
                    inBlockComment = false;
                    i += 1;
                }
                continue;
            }

            if (!inSingle && !inDouble && !inTemplate) {
                if (current === '/' && next === '/') {
                    inLineComment = true;
                    i += 1;
                    continue;
                }

                if (current === '/' && next === '*') {
                    inBlockComment = true;
                    i += 1;
                    continue;
                }
            }

            if (inSingle) {
                output += current;
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '\'') {
                    inSingle = false;
                }
                escaped = false;
                continue;
            }

            if (inDouble) {
                output += current;
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '"') {
                    inDouble = false;
                }
                escaped = false;
                continue;
            }

            if (inTemplate) {
                output += current;
                if (!escaped && current === '\\') {
                    escaped = true;
                    continue;
                }
                if (!escaped && current === '`') {
                    inTemplate = false;
                }
                escaped = false;
                continue;
            }

            if (current === '\'') {
                inSingle = true;
                output += current;
                continue;
            }

            if (current === '"') {
                inDouble = true;
                output += current;
                continue;
            }

            if (current === '`') {
                inTemplate = true;
                output += current;
                continue;
            }

            output += current;
        }

        return output;
    }

    /** 修复对象字面量的常见格式问题。 */
    static normalizeLiteral(literal) {
        return literal
            .replace(/\u00A0/g, ' ')
            .replace(/,\s*([}\]])/g, '$1')
            .trim();
    }

    /** 使用受控 Function 执行对象字面量并返回对象。 */
    static evaluateLiteral(literal) {
        try {
            return new Function(`"use strict"; return (${literal});`)();
        } catch (error) {
            throw new Error(`配置对象语法错误: ${error.message}`);
        }
    }

    /** 判断数组是否适合单行紧凑格式。 */
    static isCompactArray(arrayValue) {
        return arrayValue.length <= 8 && arrayValue.every(item => {
            if (Array.isArray(item)) {
                return item.length <= 4 && item.every(sub => typeof sub === 'string' || typeof sub === 'number');
            }
            return ['string', 'number', 'boolean'].includes(typeof item) || item === null;
        });
    }

    /** 将普通字符串转义为单引号字面量。 */
    static quoteString(value) {
        return `'${String(value)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')}'`;
    }

    /** 格式化任意值为可读 JS 片段。 */
    static formatValue(value, indentLevel = 0) {
        const indent = '    '.repeat(indentLevel);
        const childIndent = '    '.repeat(indentLevel + 1);

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }

            if (this.isCompactArray(value)) {
                const compactItems = value.map(item => this.formatValue(item, 0));
                return `[${compactItems.join(', ')}]`;
            }

            const lines = value.map(item => `${childIndent}${this.formatValue(item, indentLevel + 1)}`);
            return `[\n${lines.join(',\n')}\n${indent}]`;
        }

        if (value && typeof value === 'object') {
            const entries = Object.entries(value);
            if (entries.length === 0) {
                return '{}';
            }

            const lines = entries.map(([key, item]) => {
                const validIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
                const formattedKey = validIdentifier ? key : this.quoteString(key);
                const formattedValue = this.formatValue(item, indentLevel + 1);
                return `${childIndent}${formattedKey}: ${formattedValue}`;
            });

            return `{\n${lines.join(',\n')}\n${indent}}`;
        }

        if (typeof value === 'string') {
            return this.quoteString(value);
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (value === null) {
            return 'null';
        }

        return this.quoteString(String(value));
    }

    /** 按预设顺序返回根字段列表。 */
    static getOrderedRootEntries(config) {
        const source = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
        const entries = [];

        this.ROOT_FIELD_ORDER.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                entries.push([key, source[key]]);
            }
        });

        Object.keys(source).forEach(key => {
            if (!this.ROOT_FIELD_ORDER.includes(key)) {
                entries.push([key, source[key]]);
            }
        });

        return entries;
    }

    /** 渲染根字段注释块。 */
    static formatRootComments(key) {
        const comments = this.ROOT_FIELD_COMMENTS[key] || [];
        if (comments.length === 0) {
            return '';
        }

        return `${comments.map(line => `    // ${line}`).join('\n')}\n`;
    }

    /** 按预设顺序格式化样式对象，并附带行尾注释。 */
    static formatStyleObject(styleConfig, indentLevel = 1) {
        const indent = '    '.repeat(indentLevel);
        const childIndent = '    '.repeat(indentLevel + 1);
        const source = styleConfig && typeof styleConfig === 'object' && !Array.isArray(styleConfig) ? styleConfig : {};
        const orderedKeys = [];

        this.STYLE_FIELD_ORDER.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                orderedKeys.push(key);
            }
        });

        Object.keys(source).forEach(key => {
            if (!orderedKeys.includes(key)) {
                orderedKeys.push(key);
            }
        });

        if (orderedKeys.length === 0) {
            return '{}';
        }

        const lines = orderedKeys.map(key => {
            const formattedKey = this.quoteString(key);
            const formattedValue = this.formatValue(source[key], indentLevel + 1);
            const lineComment = this.STYLE_FIELD_COMMENTS[key];

            if (lineComment) {
                return `${childIndent}${formattedKey}: ${formattedValue}, // ${lineComment}`;
            }

            return `${childIndent}${formattedKey}: ${formattedValue},`;
        });

        return `{\n${lines.join('\n')}\n${indent}}`;
    }

    /** 生成标准化的 scheduleConfig.js 文本。 */
    static generateJS(config) {
        const lines = this.getOrderedRootEntries(config).map(([key, value]) => {
            const comments = this.formatRootComments(key);
            const formattedValue = key === 'css_style'
                ? this.formatStyleObject(value, 1)
                : this.formatValue(value, 1);

            return `${comments}    ${key}: ${formattedValue},`;
        });

        return `// 此文件为配置模板\nconst _scheduleConfig = {\n\n${lines.join('\n\n')}\n\n}\n\nvar scheduleConfig = JSON.parse(JSON.stringify(_scheduleConfig))`;
    }
}
