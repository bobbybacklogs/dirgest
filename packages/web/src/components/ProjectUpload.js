import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState, useCallback, useEffect } from 'react';
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
    const filesRef = useRef(null);
    const folderRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        folderRef.current?.setAttribute('webkitdirectory', '');
        folderRef.current?.setAttribute('directory', '');
    }, []);
    const handleFiles = useCallback(async (fileList) => {
        if (!fileList || fileList.length === 0)
            return;
        const files = await readFiles(fileList);
        if (files.length === 0) {
            setError('No readable source files under 512 KB were found.');
            return;
        }
        setError(null);
        onUpload(files);
    }, [onUpload]);
    return (_jsxs("div", { className: "landing", children: [_jsxs("section", { className: "landing-copy", children: [_jsx("p", { className: "hero-kicker", children: "Local project briefing" }), _jsx("h2", { children: "Read the repo. Decide what to build next." }), _jsx("p", { children: "Dirgest samples the important files, names the stack, and hands you coding prompts you can paste into an agent." }), _jsxs("ul", { className: "landing-points", children: [_jsx("li", { children: "Drop a folder or a handful of source files" }), _jsx("li", { children: "Generate ideas in balanced, growth, ux, technical, or wild mode" }), _jsx("li", { children: "Save prompts across runs and copy them in one shot" })] })] }), _jsxs("div", { className: `upload-zone ${dragOver ? 'drag-over' : ''}`, onDragOver: (e) => {
                    e.preventDefault();
                    setDragOver(true);
                }, onDragLeave: () => setDragOver(false), onDrop: (e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void handleFiles(e.dataTransfer.files);
                }, children: [_jsx("input", { ref: filesRef, type: "file", multiple: true, style: { display: 'none' }, onChange: (e) => {
                            void handleFiles(e.target.files);
                            e.target.value = '';
                        } }), _jsx("input", { ref: folderRef, type: "file", multiple: true, style: { display: 'none' }, onChange: (e) => {
                            void handleFiles(e.target.files);
                            e.target.value = '';
                        } }), _jsx("h3", { children: "Drop a project folder" }), _jsx("p", { children: "or choose files from disk. Analysis stays on this machine until you generate ideas." }), _jsxs("div", { className: "quick-row", children: [_jsx("button", { className: "btn btn-primary", type: "button", onClick: () => folderRef.current?.click(), children: "Choose folder" }), _jsx("button", { className: "btn", type: "button", onClick: () => filesRef.current?.click(), children: "Choose files" })] }), error && _jsx("p", { className: "upload-error", children: error })] })] }));
}
