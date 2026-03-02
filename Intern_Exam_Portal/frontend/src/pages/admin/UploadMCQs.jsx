import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import API from '../../api';
import './UploadMCQs.css';

export default function UploadMCQs() {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const inputRef = useRef();

    const handleFile = (f) => {
        if (!f) return;
        if (!f.name.match(/\.(xlsx|xls)$/)) {
            toast.error('Please select an Excel file (.xlsx or .xls)');
            return;
        }
        setFile(f);
        setResult(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!file) { toast.error('Please select a file first'); return; }
        setLoading(true);
        setResult(null);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await API.post('/admin/upload-mcqs', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult({ success: true, message: res.data.message, count: res.data.count });
            toast.success(res.data.message);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Upload failed';
            setResult({ success: false, message: msg });
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <h1>Upload MCQs</h1>
                <p>Bulk import up to 25 questions from an Excel spreadsheet</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                <div>
                    {/* Drop zone */}
                    <div
                        className={`drop-zone ${dragging ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current.click()}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFile(e.target.files[0])}
                        />
                        {file ? (
                            <>
                                <FileSpreadsheet size={40} color="#059669" />
                                <p className="drop-title" style={{ color: '#059669' }}>{file.name}</p>
                                <p className="drop-sub">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginTop: 12 }}
                                    onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                                >
                                    <X size={14} /> Remove
                                </button>
                            </>
                        ) : (
                            <>
                                <Upload size={40} color="var(--primary)" />
                                <p className="drop-title">Drag & Drop your Excel file here</p>
                                <p className="drop-sub">or click to browse · Supports .xlsx and .xls</p>
                            </>
                        )}
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`alert ${result.success ? 'alert-success' : 'alert-danger'}`} style={{ marginTop: 16 }}>
                            {result.success
                                ? <><CheckCircle size={16} /> {result.message}</>
                                : <><AlertCircle size={16} /> {result.message}</>
                            }
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleUpload}
                        disabled={loading || !file}
                        style={{ marginTop: 16 }}
                    >
                        {loading ? 'Uploading...' : <><Upload size={16} /> Upload Questions</>}
                    </button>
                </div>

                {/* Format guide */}
                <div className="card card-sm">
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Required Columns</h3>
                    <div className="col-list">
                        {['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'].map((col, i) => (
                            <div key={col} className="col-item">
                                <span className="col-num">{i + 1}</span>
                                <code>{col}</code>
                            </div>
                        ))}
                    </div>
                    <div className="alert alert-warning" style={{ marginTop: 16, fontSize: 13 }}>
                        <strong>correct_answer</strong> must be exactly: <code>a</code>, <code>b</code>, <code>c</code>, or <code>d</code>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                        Uploading will replace all existing questions.
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}
