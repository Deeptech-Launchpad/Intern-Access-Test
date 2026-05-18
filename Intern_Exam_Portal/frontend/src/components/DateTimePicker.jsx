import React, { useMemo } from 'react';

function parseISOToParts(iso) {
    if (!iso) return { date: '', hour12: '12', minute: '0', ampm: 'AM' };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '', hour12: '12', minute: '0', ampm: 'AM' };
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const h24 = d.getHours();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((h24 + 11) % 12) + 1;
    const minute = Math.floor(d.getMinutes() / 5) * 5;
    return { date, hour12: String(hour12), minute: String(minute), ampm };
}

function partsToISO(date, hour12, minute, ampm) {
    if (!date) return '';
    const h12 = parseInt(hour12, 10) || 12;
    const m   = parseInt(minute, 10) || 0;
    let h24 = h12 % 12;
    if (ampm === 'PM') h24 += 12;
    const local = new Date(`${date}T${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    if (isNaN(local.getTime())) return '';
    return local.toISOString();
}

export default function DateTimePicker({ value, onChange, min, minuteStep = 5, disabled = false }) {
    const parts = useMemo(() => parseISOToParts(value), [value]);

    const minDate = useMemo(() => {
        if (!min) return undefined;
        const d = new Date(min);
        if (isNaN(d.getTime())) return undefined;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }, [min]);

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep);

    const emit = (nextParts) => {
        if (!nextParts.date) {
            onChange('');
            return;
        }
        onChange(partsToISO(nextParts.date, nextParts.hour12, nextParts.minute, nextParts.ampm));
    };

    const onDateChange = (e) => emit({ ...parts, date: e.target.value });
    const onHourChange = (e) => emit({ ...parts, hour12: e.target.value });
    const onMinuteChange = (e) => emit({ ...parts, minute: e.target.value });
    const onAmpmChange = (e) => emit({ ...parts, ampm: e.target.value });

    const timeDisabled = disabled || !parts.date;

    const selectStyle = {
        padding: '8px 6px',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 6,
        background: timeDisabled ? '#f3f4f6' : '#fff',
        fontSize: 13,
        color: 'var(--text, #111827)',
        boxSizing: 'border-box',
        cursor: timeDisabled ? 'not-allowed' : 'pointer',
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, alignItems: 'center' }}>
            <input
                type="date"
                min={minDate}
                value={parts.date}
                disabled={disabled}
                onChange={onDateChange}
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '8px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13 }}
            />
            <select value={parts.hour12} disabled={timeDisabled} onChange={onHourChange} style={selectStyle} title="Hour">
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select value={parts.minute} disabled={timeDisabled} onChange={onMinuteChange} style={selectStyle} title="Minute">
                {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
            </select>
            <select value={parts.ampm} disabled={timeDisabled} onChange={onAmpmChange} style={selectStyle} title="AM/PM">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
}
