class ConfigParser {
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

    /** 生成标准化的 scheduleConfig.js 文本。 */
    static generateJS(config) {
        const formattedConfig = this.formatValue(config, 0);
        return `const _scheduleConfig = ${formattedConfig};\n\nvar scheduleConfig = JSON.parse(JSON.stringify(_scheduleConfig));`;
    }
}
