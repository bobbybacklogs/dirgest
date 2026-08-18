import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState, useCallback } from 'react';
async function readFiles(fileList) {
    const files = [];
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.size > 512_000)
            continue;
        const content = await file.text();
        files.push({ path: file.webkitRelativePath || file.name, content });
    }
    return files;
}
export function ProjectUpload({ onUpload }) {
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const handleFiles = useCallback(async (fileList) => {
        const files = await readFiles(fileList);
        if (files.length > 0)
            onUpload(files);
    }, [onUpload]);
    return (_jsxs("div", { className: `upload-zone ${dragOver ? 'drag-over' : ''}`, onClick: () => inputRef.current?.click(), onDragOver: (e) => {
            e.preventDefault();
            setDragOver(true);
        }, onDragLeave: () => setDragOver(false), onDrop: (e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0)
                handleFiles(e.dataTransfer.files);
        }, children: [_jsx("input", { ref: inputRef, type: "file", multiple: true, style: { display: 'none' }, onChange: (e) => {
                    if (e.target.files && e.target.files.length > 0)
                        handleFiles(e.target.files);
                } }), _jsx("h2", { children: "Drop your project here" }), _jsx("p", { children: "or click to select files" }), _jsx("p", { className: "hint", children: "Dirgest will analyze your source files locally \u2014 nothing leaves your machine until you generate suggestions." })] }));
}
