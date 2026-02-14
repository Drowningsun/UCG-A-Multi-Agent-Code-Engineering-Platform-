import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CodeBlock } from './GenUIComponents';
import { parseCodeFiles } from '../utils/parseCodeFiles';
import './TabbedCodeBlock.css';

/* ========== File Tree Node (recursive) ========== */
const TreeNode = ({ node, depth = 0, activeIndex, onSelect }) => {
    const [expanded, setExpanded] = useState(true);

    if (node.type === 'file') {
        const isActive = node.fileIndex === activeIndex;
        return (
            <div
                className={`tree-file ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => onSelect(node.fileIndex)}
            >
                <span className="tree-file-icon">{node.icon}</span>
                <span className="tree-file-name">{node.name}</span>
                <span className="tree-file-lines">✓ {node.lines}L</span>
            </div>
        );
    }

    // Folder node
    return (
        <div className="tree-folder">
            <div
                className="tree-folder-header"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                <span className={`tree-arrow ${expanded ? 'open' : ''}`}>▶</span>
                <span className="tree-folder-icon">{expanded ? '📂' : '📁'}</span>
                <span className="tree-folder-name">{node.name}</span>
            </div>
            {expanded && (
                <div className="tree-folder-children">
                    {node.children.map((child, i) => (
                        <TreeNode
                            key={child.name + i}
                            node={child}
                            depth={depth + 1}
                            activeIndex={activeIndex}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ========== Main Component ========== */
const TabbedCodeBlock = ({ code, maxHeight = 'calc(100vh - 250px)', onCopyCode }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [copyStatus, setCopyStatus] = useState('');
    const [downloadStatus, setDownloadStatus] = useState('');

    const { files, isMultiFile, tree, totalLines } = useMemo(() => parseCodeFiles(code), [code]);

    // Single file → plain CodeBlock, no chrome
    if (!isMultiFile || files.length <= 1) {
        const file = files[0];
        return (
            <CodeBlock
                code={file?.code || code || ''}
                language={file?.language || 'python'}
                lineNumbers={true}
                maxHeight={maxHeight}
            />
        );
    }

    const activeFile = files[activeTab] || files[0];

    const handleCopy = async (fileCode) => {
        let success = false;
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(fileCode); success = true; } catch (e) { }
        }
        if (!success) {
            const ta = document.createElement('textarea');
            ta.value = fileCode;
            ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { success = document.execCommand('copy'); } catch (e) { }
            document.body.removeChild(ta);
        }
        setCopyStatus(success ? '✓ Copied!' : 'Failed');
        if (success && onCopyCode) onCopyCode(fileCode);
        setTimeout(() => setCopyStatus(''), 2000);
    };

    const handleDownloadZip = async () => {
        try {
            setDownloadStatus('Zipping...');
            const zip = new JSZip();
            files.forEach(file => zip.file(file.filepath, file.code));
            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, 'generated-code.zip');
            setDownloadStatus('✓ Done!');
        } catch (err) {
            console.error('ZIP error:', err);
            setDownloadStatus('Failed');
        }
        setTimeout(() => setDownloadStatus(''), 2500);
    };

    return (
        <div className="project-viewer">
            {/* Left Sidebar — File Tree */}
            <aside className="pv-sidebar">
                <div className="pv-sidebar-header">
                    <span className="pv-project-icon">📁</span>
                    <div className="pv-project-info">
                        <span className="pv-project-name">project</span>
                        <span className="pv-project-meta">{files.length} files • {totalLines} lines</span>
                    </div>
                </div>
                <div className="pv-tree-container">
                    {tree && tree.children.map((child, i) => (
                        <TreeNode
                            key={child.name + i}
                            node={child}
                            depth={0}
                            activeIndex={activeTab}
                            onSelect={setActiveTab}
                        />
                    ))}
                </div>
            </aside>

            {/* Right Panel — Tabs + Code */}
            <div className="pv-main">
                {/* Header Bar */}
                <div className="pv-header">
                    <div className="pv-file-info">
                        <span className="pv-active-icon">{activeFile.icon}</span>
                        <span className="pv-active-name">{activeFile.filename}</span>
                        <span className="pv-active-lines">{activeFile.code.split('\n').length} lines</span>
                    </div>
                    <div className="pv-header-actions">
                        <button className="pv-action-btn" onClick={() => handleCopy(activeFile.code)}>
                            {copyStatus || '📋 Copy'}
                        </button>
                        <button
                            className="pv-action-btn pv-download-btn"
                            onClick={handleDownloadZip}
                            disabled={downloadStatus === 'Zipping...'}
                        >
                            {downloadStatus || '⬇ Download ZIP'}
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="pv-tabs">
                    {files.map((file, index) => (
                        <button
                            key={index}
                            className={`pv-tab ${index === activeTab ? 'active' : ''}`}
                            onClick={() => setActiveTab(index)}
                            title={file.filepath}
                        >
                            <span className="pv-tab-icon">{file.icon}</span>
                            <span className="pv-tab-name">{file.filename}</span>
                        </button>
                    ))}
                </div>

                {/* Code Area */}
                <div className="pv-code">
                    <CodeBlock
                        code={activeFile.code}
                        language={activeFile.language}
                        lineNumbers={true}
                        maxHeight={maxHeight}
                    />
                </div>
            </div>
        </div>
    );
};

export default TabbedCodeBlock;
