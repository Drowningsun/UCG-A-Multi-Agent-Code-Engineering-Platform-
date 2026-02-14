/**
 * parseCodeFiles.js
 * 
 * Splits multi-file AI code output into separate files based on markers.
 * Supports nested paths (e.g., src/components/TodoForm.js).
 * Builds a folder tree structure for sidebar rendering.
 */

const EXTENSION_LANG_MAP = {
    html: 'html',
    htm: 'html',
    css: 'css',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
};

const FILE_ICONS = {
    html: '🌐',
    css: '🎨',
    javascript: '⚡',
    typescript: '💎',
    python: '🐍',
    json: '📋',
    markdown: '📝',
    sql: '🗄️',
    bash: '💻',
    default: '📄',
};

/**
 * Regex to match file markers:
 *   <!-- path/to/filename.ext -->
 *   // path/to/filename.ext
 *   # path/to/filename.ext
 *   /* path/to/filename.ext * /
 */
const FILE_MARKER_REGEX = /^(?:<!--\s*(.+?\.\w{1,5})\s*-->|\/\/\s*(.+?\.\w{1,5})\s*$|#\s*(.+?\.\w{1,5})\s*$|\/\*\s*(.+?\.\w{1,5})\s*\*\/)/;

/**
 * Parse raw code output into separate files.
 */
export function parseCodeFiles(code) {
    if (!code || typeof code !== 'string') {
        return { files: [], isMultiFile: false, tree: null, totalLines: 0 };
    }

    const lines = code.split('\n');
    const files = [];
    let currentFile = null;
    let currentLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(FILE_MARKER_REGEX);

        if (match) {
            if (currentFile) {
                currentFile.code = currentLines.join('\n').trim();
                if (currentFile.code) {
                    files.push(currentFile);
                }
            }

            const filepath = match[1] || match[2] || match[3] || match[4];
            const parts = filepath.split('/');
            const filename = parts[parts.length - 1];
            const ext = filename.split('.').pop().toLowerCase();
            const language = EXTENSION_LANG_MAP[ext] || ext;

            currentFile = {
                filepath,        // full path e.g. "src/components/TodoForm.js"
                filename,        // just the name e.g. "TodoForm.js"
                language,
                icon: FILE_ICONS[language] || FILE_ICONS.default,
                code: '',
            };
            currentLines = [];
        } else {
            currentLines.push(lines[i]);
        }
    }

    // Save last file
    if (currentFile) {
        currentFile.code = currentLines.join('\n').trim();
        if (currentFile.code) {
            files.push(currentFile);
        }
    }

    // Single-file fallback
    if (files.length === 0) {
        const language = detectLanguage(code);
        return {
            files: [{
                filepath: `code.${getExtension(language)}`,
                filename: `code.${getExtension(language)}`,
                language,
                icon: FILE_ICONS[language] || FILE_ICONS.default,
                code: code.trim(),
            }],
            isMultiFile: false,
            tree: null,
            totalLines: code.split('\n').length,
        };
    }

    const totalLines = files.reduce((sum, f) => sum + f.code.split('\n').length, 0);
    const tree = buildFileTree(files);

    return { files, isMultiFile: files.length > 1, tree, totalLines };
}

/**
 * Build a nested folder tree from flat file paths.
 * 
 * Returns: { name: 'project', type: 'folder', children: [...] }
 * Each child is either:
 *   { name, type: 'folder', children: [...] }
 *   { name, type: 'file', fileIndex, icon, lines }
 */
export function buildFileTree(files) {
    const root = { name: 'project', type: 'folder', children: [] };

    files.forEach((file, index) => {
        const parts = file.filepath.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (isFile) {
                current.children.push({
                    name: part,
                    type: 'file',
                    fileIndex: index,
                    icon: file.icon,
                    lines: file.code.split('\n').length,
                });
            } else {
                let folder = current.children.find(c => c.type === 'folder' && c.name === part);
                if (!folder) {
                    folder = { name: part, type: 'folder', children: [] };
                    current.children.push(folder);
                }
                current = folder;
            }
        }
    });

    // Sort: folders first, then files, alphabetically within each group
    sortTree(root);

    return root;
}

function sortTree(node) {
    if (node.type === 'folder' && node.children) {
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    }
}

function detectLanguage(code) {
    if (code.includes('<!DOCTYPE') || code.includes('<html')) return 'html';
    if (code.includes('import React') || code.includes('useState')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
    if (code.includes('class ') && code.includes('{')) return 'javascript';
    if (code.includes('body {') || code.includes('.container')) return 'css';
    return 'python';
}

function getExtension(language) {
    const map = { python: 'py', javascript: 'js', typescript: 'ts', html: 'html', css: 'css', json: 'json' };
    return map[language] || 'txt';
}

export { FILE_ICONS, EXTENSION_LANG_MAP };
