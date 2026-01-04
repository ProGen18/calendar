import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    fetchCalendarEvents,
    getUniqueTypes,
    filterEvents,
    getEventsForDate,
    getWeekDates,
    cacheEvents,
    loadCachedEvents,
} from './calendarService';

// View modes
const VIEW_MODES = {
    DAY: 'day',
    AGENDA: 'agenda',
    MONTH: 'month',
    TOOLS: 'tools',
};

// Default settings
const DEFAULT_SETTINGS = {
    icsUrl: '',
    secondaryIcsUrl: '', // Optional secondary calendar
    secondaryMode: 'merge', // 'merge' or 'separate'
    groupNumber: null,
    bannedPatterns: [], // Array of {pattern: string, isRegex: boolean, enabled: boolean}
    hiddenSubjects: [],
    hiddenTypes: [],
    hideSunday: true, // Hide Sunday in week navigation
    viewMode: VIEW_MODES.DAY,
};

// Storage key
const STORAGE_KEY = 'celcat-calendar-settings';

// Load settings from localStorage
function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

// Save settings to localStorage
function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

function formatTeacherName(name) {
    if (!name) return '';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '';

    if (parts.length === 1) {
        return parts[0].toUpperCase();
    }

    const isFirstPartUppercase = parts[0] === parts[0].toUpperCase() && /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ-]+$/.test(parts[0]);
    const isLastPartUppercase = parts[parts.length - 1] === parts[parts.length - 1].toUpperCase() && /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ-]+$/.test(parts[parts.length - 1]);

    let lastName, firstName;

    if (isFirstPartUppercase && !isLastPartUppercase) {
        lastName = parts[0];
        firstName = parts.slice(1).join(' ');
    } else if (isLastPartUppercase && !isFirstPartUppercase) {
        firstName = parts.slice(0, -1).join(' ');
        lastName = parts[parts.length - 1];
    } else {
        lastName = parts[0];
        firstName = parts.slice(1).join(' ');
    }
    const formattedLastName = lastName.toUpperCase();
    const formattedFirstName = firstName
        ? firstName.split(' ').map(p =>
            p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        ).join(' ')
        : '';

    return formattedFirstName
        ? `${formattedLastName} ${formattedFirstName}`
        : formattedLastName;
}

/**
 * Format all teacher names in an array
 */
function formatTeachers(staff) {
    if (!staff || staff.length === 0) return '';
    return staff.map(formatTeacherName).join(', ');
}

// Icons as SVG components
const Icons = {
    Filter: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
    ),
    Settings: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    Clock: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    MapPin: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    User: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Users: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    ChevronLeft: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    ),
    ChevronRight: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    X: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Plus: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Trash: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Calendar: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    List: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
    ),
    Refresh: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
    ),
    ChevronUp: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
        </svg>
    ),
    ChevronDown: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
        </svg>
    ),
    AlertCircle: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    ),
    Info: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
    Rocket: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
    ),
    Save: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    ),
    BookOpen: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
    Mail: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    ),
    Search: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
    ExternalLink: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    ),
    BarChart: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    ),
    Zap: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    MoreVertical: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
        </svg>
    ),
};

// Helper functions
function formatDateHeader(date) {
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
}

function formatWeekday(date) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3);
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

function isToday(date) {
    return isSameDay(date, new Date());
}

// Color generator
function getSubjectColor(subjectName) {
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
        hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Check if event matches banned patterns
function matchesBannedPatterns(event, bannedPatterns) {
    const searchText = [
        event.title,
        event.subjectName,
        event.group,
        event.module,
        event.notes,
        event.staff?.join(' '),
    ].filter(Boolean).join(' ').toLowerCase();

    for (const { pattern, isRegex, enabled } of bannedPatterns) {
        if (!enabled || !pattern) continue;

        try {
            if (isRegex) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(searchText)) return true;
            } else {
                if (searchText.includes(pattern.toLowerCase())) return true;
            }
        } catch (e) {
            // Invalid regex, skip
            console.warn('Invalid pattern:', pattern, e);
        }
    }
    return false;
}

// Apply all filters including banned patterns
function applyAllFilters(events, settings) {
    const visible = [];
    const hidden = [];

    for (const event of events) {
        let isHidden = false;

        // Banned patterns
        if (matchesBannedPatterns(event, settings.bannedPatterns)) isHidden = true;
        // Hidden subjects
        else if (settings.hiddenSubjects.includes(event.subjectName)) isHidden = true;
        // Hidden types
        else if (settings.hiddenTypes.includes(event.type)) isHidden = true;
        // Group filter
        else if (settings.groupNumber && event.groupNumber && event.groupNumber !== settings.groupNumber) isHidden = true;

        if (isHidden) hidden.push(event);
        else visible.push(event);
    }

    return { visible, hidden };
}

// Get unique subjects with colors
function getUniqueSubjects(events) {
    const subjects = new Map();
    for (const event of events) {
        if (!subjects.has(event.subjectName)) {
            subjects.set(event.subjectName, {
                name: event.subjectName,
                color: getSubjectColor(event.subjectName),
                count: 0,
            });
        }
        subjects.get(event.subjectName).count++;
    }
    return Array.from(subjects.values()).sort((a, b) => b.count - a.count);
}

// Get next upcoming event
function getNextEvent(events) {
    const now = new Date();
    return events.find(e => e.start > now) || null;
}

// Get current ongoing event
function getCurrentEvent(events) {
    const now = new Date();
    return events.find(e => e.start <= now && e.end > now) || null;
}

// Calculate time remaining until a date
function getTimeRemaining(targetDate) {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, total: diff };
}

// Calculate weekly statistics
function getWeeklyStats(events, weekDates) {
    const weekStart = new Date(weekDates[0]);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekDates[6]);
    weekEnd.setHours(23, 59, 59, 999);

    const weekEvents = events.filter(e => e.start >= weekStart && e.start <= weekEnd);

    let totalMinutes = 0;
    const byType = { CM: 0, TD: 0, TP: 0, OTHER: 0, EXAM: 0 };
    const byDay = [0, 0, 0, 0, 0, 0, 0];

    for (const event of weekEvents) {
        totalMinutes += event.duration || 0;
        byType[event.type] = (byType[event.type] || 0) + (event.duration || 0);
        const dayIndex = weekDates.findIndex(d => isSameDay(d, event.start));
        if (dayIndex >= 0) byDay[dayIndex] += event.duration || 0;
    }

    return {
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        eventCount: weekEvents.length,
        byType,
        byDay,
    };
}

// Generate Google Calendar URL
function generateGoogleCalendarUrl(event) {
    const formatGoogleDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.subjectName || event.title,
        dates: `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`,
        details: [
            event.staff?.length ? `Enseignant: ${event.staff.join(', ')}` : '',
            event.notes || '',
        ].filter(Boolean).join('\n'),
        location: event.room || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Search filter function
function searchEvents(events, query) {
    if (!query.trim()) return events;
    const q = query.toLowerCase();
    return events.filter(e => {
        const searchable = [
            e.title, e.subjectName, e.room, e.module, e.notes,
            e.staff?.join(' '),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(q);
    });
}

// Generate ICS file content for universal export (Apple, Outlook, etc.)
function generateICSContent(event) {
    const formatICSDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const escapeICS = (str) => {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const uid = `${event.id || Date.now()}@celcat-calendar`;
    const description = [
        event.staff?.length ? `Enseignant: ${event.staff.join(', ')}` : '',
        event.group ? `Groupe: ${event.group}` : '',
        event.notes || '',
    ].filter(Boolean).join('\n');

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CELCAT Calendar//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(event.start)}`,
        `DTEND:${formatICSDate(event.end)}`,
        `SUMMARY:${escapeICS(event.subjectName || event.title)}`,
        event.room ? `LOCATION:${escapeICS(event.room)}` : '',
        description ? `DESCRIPTION:${escapeICS(description)}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    return icsContent;
}

// Share/Add to calendar - uses native share on mobile, download on desktop
async function shareToCalendar(event) {
    const content = generateICSContent(event);
    const filename = `${(event.subjectName || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;

    // Try Web Share API first (mobile native share)
    if (navigator.share && navigator.canShare) {
        try {
            const file = new File([content], filename, { type: 'text/calendar' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: event.subjectName || 'Événement',
                });
                return;
            }
        } catch (err) {
            console.log('Share failed, trying data URL', err);
        }
    }

    // Fallback: Use data URL which opens calendar app directly on mobile
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Create link and trigger
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // On iOS Safari, using location.href opens the calendar app
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        window.location.href = url;
    } else {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Settings Panel Component
function SettingsPanel({ isOpen, onClose, settings, onSettingsChange, onReload }) {
    const [localSettings, setLocalSettings] = useState(settings);
    const [newPattern, setNewPattern] = useState('');
    const [isRegex, setIsRegex] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        onSettingsChange(localSettings);
        onClose();
        if (localSettings.icsUrl !== settings.icsUrl) {
            onReload();
        }
    };

    const handleAddPattern = () => {
        if (!newPattern.trim()) return;

        // Validate regex if needed
        if (isRegex) {
            try {
                new RegExp(newPattern);
            } catch (e) {
                alert('Expression régulière invalide');
                return;
            }
        }

        setLocalSettings(prev => ({
            ...prev,
            bannedPatterns: [
                ...prev.bannedPatterns,
                { pattern: newPattern.trim(), isRegex, enabled: true }
            ]
        }));
        setNewPattern('');
        setIsRegex(false);
    };

    const handleRemovePattern = (index) => {
        setLocalSettings(prev => ({
            ...prev,
            bannedPatterns: prev.bannedPatterns.filter((_, i) => i !== index)
        }));
    };

    const handleTogglePattern = (index) => {
        setLocalSettings(prev => ({
            ...prev,
            bannedPatterns: prev.bannedPatterns.map((p, i) =>
                i === index ? { ...p, enabled: !p.enabled } : p
            )
        }));
    };

    return (
        <>
            <div className={`filter-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <div className={`filter-panel ${isOpen ? 'open' : ''}`}>
                <div className="filter-panel__header">
                    <h2 className="filter-panel__title"><Icons.Settings /> Paramètres</h2>
                    <button className="filter-panel__close" onClick={onClose}>
                        <Icons.X />
                    </button>
                </div>

                <div className="filter-panel__content">
                    {/* ICS URL */}
                    <div className="filter-section">
                        <h3 className="filter-section__title"><Icons.Calendar /> URL du Calendrier</h3>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                            Collez votre lien ICS (webcal:// ou https://)
                        </p>
                        <input
                            type="url"
                            className="settings-input"
                            placeholder="https://... ou webcal://..."
                            value={localSettings.icsUrl}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, icsUrl: e.target.value }))}
                        />
                    </div>

                    {/* Group Filter */}
                    <div className="filter-section">
                        <h3 className="filter-section__title"><Icons.Users /> Numéro de Groupe</h3>
                        <div className="filter-chips">
                            <button
                                className={`filter-chip ${!localSettings.groupNumber ? 'active' : ''}`}
                                onClick={() => setLocalSettings(prev => ({ ...prev, groupNumber: null }))}
                            >
                                Tous
                            </button>
                            {[1, 2, 3, 4, 5].map((num) => (
                                <button
                                    key={num}
                                    className={`filter-chip ${localSettings.groupNumber === num ? 'active' : ''}`}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, groupNumber: num }))}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Banned Patterns */}
                    <div className="filter-section">
                        <h3 className="filter-section__title"><Icons.AlertCircle /> Mots/Patterns Bannis</h3>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                            Les cours contenant ces mots seront masqués
                        </p>

                        {/* Add new pattern */}
                        <div className="pattern-add">
                            <input
                                type="text"
                                className="settings-input settings-input--small"
                                placeholder="Ex: LICENCE 2 ou L2INFO.*"
                                value={newPattern}
                                onChange={(e) => setNewPattern(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
                            />
                            <label className="pattern-add__regex">
                                <input
                                    type="checkbox"
                                    checked={isRegex}
                                    onChange={(e) => setIsRegex(e.target.checked)}
                                />
                                <span>Regex</span>
                            </label>
                            <button
                                className="btn btn--primary btn--icon"
                                onClick={handleAddPattern}
                                title="Ajouter"
                            >
                                <Icons.Plus />
                            </button>
                        </div>

                        {/* Pattern list */}
                        <div className="pattern-list">
                            {localSettings.bannedPatterns.length === 0 && (
                                <div className="pattern-list__empty">
                                    Aucun pattern. Ajoutez des mots-clés à bannir.
                                </div>
                            )}
                            {localSettings.bannedPatterns.map((p, index) => (
                                <div key={index} className={`pattern-item ${!p.enabled ? 'disabled' : ''}`}>
                                    <label className="toggle-switch toggle-switch--small">
                                        <input
                                            type="checkbox"
                                            checked={p.enabled}
                                            onChange={() => handleTogglePattern(index)}
                                        />
                                        <span className="toggle-switch__slider" />
                                    </label>
                                    <div className="pattern-item__content">
                                        <code className="pattern-item__pattern">{p.pattern}</code>
                                        {p.isRegex && <span className="pattern-item__badge">REGEX</span>}
                                    </div>
                                    <button
                                        className="btn btn--ghost btn--icon btn--small"
                                        onClick={() => handleRemovePattern(index)}
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Common patterns suggestion */}
                        <div className="pattern-suggestions">
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                                💡 Exemples de patterns :
                            </p>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                • <code>LICENCE 2</code> - Masque tous les L2<br />
                                • <code>L2INFO</code> - Masque L2 Informatique<br />
                                • <code>groupe [13]</code> (regex) - Masque groupes 1 et 3
                            </div>
                        </div>
                    </div>

                    {/* Advanced Options - Discrete */}
                    <details className="filter-section advanced-section">
                        <summary className="advanced-section__toggle">
                            <Icons.Settings /> Options avancées
                        </summary>
                        <div className="advanced-section__content">
                            <div style={{ marginTop: 'var(--space-md)' }}>
                                <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                    📡 Calendrier Secondaire (optionnel)
                                </h4>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                                    Ajouter un second flux ICS pour combiner deux emplois du temps
                                </p>
                                <input
                                    type="url"
                                    className="settings-input"
                                    placeholder="URL secondaire (optionnel)"
                                    value={localSettings.secondaryIcsUrl || ''}
                                    onChange={(e) => setLocalSettings(prev => ({ ...prev, secondaryIcsUrl: e.target.value }))}
                                />

                                {localSettings.secondaryIcsUrl && (
                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                                            Mode d'affichage :
                                        </p>
                                        <div className="filter-chips">
                                            <button
                                                className={`filter-chip ${localSettings.secondaryMode === 'merge' ? 'active' : ''}`}
                                                onClick={() => setLocalSettings(prev => ({ ...prev, secondaryMode: 'merge' }))}
                                            >
                                                🔀 Fusionner
                                            </button>
                                            <button
                                                className={`filter-chip ${localSettings.secondaryMode === 'separate' ? 'active' : ''}`}
                                                onClick={() => setLocalSettings(prev => ({ ...prev, secondaryMode: 'separate' }))}
                                            >
                                                📊 Séparés
                                            </button>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                                            {localSettings.secondaryMode === 'merge'
                                                ? '• Les deux EDT sont combinés en un seul'
                                                : '• Les événements secondaires sont marqués différemment'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Hide Sunday Option */}
                            <div style={{ marginTop: 'var(--space-md)' }}>
                                <div className="toggle-item">
                                    <div className="toggle-item__label">
                                        <span className="toggle-item__text">Masquer les dimanches</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.hideSunday ?? true}
                                            onChange={(e) => setLocalSettings(prev => ({ ...prev, hideSunday: e.target.checked }))}
                                        />
                                        <span className="toggle-switch__slider" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* Credits Section */}
                    <div className="filter-section" style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-md)' }}>
                        <h3 className="filter-section__title"><Icons.Info /> À propos</h3>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                            <p><strong>Steph Calendar v1.0</strong></p>
                            <p>Développé avec ❤️ par <strong>Stéphane Talab</strong></p>
                            <a
                                href="https://stephane-talab.fr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn--ghost btn--full"
                                style={{
                                    marginTop: 'var(--space-sm)',
                                    textDecoration: 'none',
                                    background: 'var(--bg-tertiary)',
                                    justifyContent: 'center',
                                    color: 'var(--accent-primary)'
                                }}
                            >
                                <Icons.Rocket /> Contactez-moi
                            </a>
                        </div>
                    </div>
                </div>

                <div className="filter-panel__footer">
                    <button className="btn btn--primary btn--full" onClick={handleSave}>
                        <Icons.Save /> Sauvegarder
                    </button>
                </div>
            </div>
        </>
    );
}

// Filter Panel Component (for subjects and types)
function FilterPanel({ isOpen, onClose, subjects, types, settings, onSettingsChange }) {
    const handleSubjectToggle = (subjectName) => {
        const hidden = new Set(settings.hiddenSubjects);
        if (hidden.has(subjectName)) {
            hidden.delete(subjectName);
        } else {
            hidden.add(subjectName);
        }
        onSettingsChange({ ...settings, hiddenSubjects: Array.from(hidden) });
    };

    const handleTypeToggle = (type) => {
        const hidden = new Set(settings.hiddenTypes);
        if (hidden.has(type)) {
            hidden.delete(type);
        } else {
            hidden.add(type);
        }
        onSettingsChange({ ...settings, hiddenTypes: Array.from(hidden) });
    };

    const handleShowAll = () => {
        onSettingsChange({ ...settings, hiddenSubjects: [], hiddenTypes: [] });
    };

    const handleHideAll = () => {
        onSettingsChange({ ...settings, hiddenSubjects: subjects.map(s => s.name) });
    };

    return (
        <>
            <div className={`filter-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <div className={`filter-panel ${isOpen ? 'open' : ''}`}>
                <div className="filter-panel__header">
                    <h2 className="filter-panel__title"><Icons.Filter /> Filtres Rapides</h2>
                    <button className="filter-panel__close" onClick={onClose}>
                        <Icons.X />
                    </button>
                </div>

                <div className="filter-panel__content">
                    {/* Type Filter */}
                    <div className="filter-section">
                        <h3 className="filter-section__title"><Icons.BookOpen /> Type de cours</h3>
                        <div className="filter-chips">
                            {types.map(({ type, label, count }) => (
                                <button
                                    key={type}
                                    className={`filter-chip ${!settings.hiddenTypes.includes(type) ? 'active' : ''}`}
                                    onClick={() => handleTypeToggle(type)}
                                >
                                    {label} ({count})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject Filter */}
                    <div className="filter-section">
                        <h3 className="filter-section__title">
                            <Icons.BookOpen /> Matières
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button className="btn btn--secondary btn--small" onClick={handleShowAll}>
                                    Tout afficher
                                </button>
                                <button className="btn btn--secondary btn--small" onClick={handleHideAll}>
                                    Tout masquer
                                </button>
                            </div>
                        </h3>
                        <div style={{ marginTop: 'var(--space-sm)' }}>
                            {subjects.map(({ name, color, count }) => {
                                const isVisible = !settings.hiddenSubjects.includes(name);
                                return (
                                    <div key={name} className="toggle-item">
                                        <div className="toggle-item__label">
                                            <span className="toggle-item__color" style={{ background: color }} />
                                            <span className="toggle-item__text">
                                                {name} <span style={{ color: 'var(--text-muted)' }}>({count})</span>
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={isVisible}
                                                onChange={() => handleSubjectToggle(name)}
                                            />
                                            <span className="toggle-switch__slider" />
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="filter-panel__footer">
                    <button className="btn btn--primary btn--full" onClick={onClose}>
                        Appliquer
                    </button>
                </div>
            </div>
        </>
    );
}

// Event Detail Modal
function EventDetailModal({ event, onClose }) {
    if (!event) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div className="modal">
                <div className="modal__header" style={{ borderLeftColor: getSubjectColor(event.subjectName) }}>
                    <h2 className="modal__title"><Icons.Info /> {event.subjectName}</h2>
                    <button className="modal__close" onClick={onClose}>
                        <Icons.X />
                    </button>
                </div>
                <div className="modal__content">
                    <div className="modal__section">
                        <div className="modal__label"><Icons.Clock /> Horaire</div>
                        <div className="modal__value">{event.startTime} - {event.endTime}</div>
                    </div>
                    <div className="modal__section">
                        <div className="modal__label"><Icons.Calendar /> Date</div>
                        <div className="modal__value">
                            {event.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    {event.room && (
                        <div className="modal__section">
                            <div className="modal__label"><Icons.MapPin /> Salle</div>
                            <div className="modal__value modal__value--highlight">{event.room}</div>
                        </div>
                    )}
                    {event.staff?.length > 0 && (
                        <div className="modal__section">
                            <div className="modal__label"><Icons.User /> Enseignant(s)</div>
                            <div className="modal__value">{event.staff.join(', ')}</div>
                        </div>
                    )}
                    {event.group && (
                        <div className="modal__section">
                            <div className="modal__label"><Icons.Users /> Groupe</div>
                            <div className="modal__value">{event.group}</div>
                        </div>
                    )}
                    {event.notes && (
                        <div className="modal__section">
                            <div className="modal__label"><Icons.Info /> Notes</div>
                            <div className="modal__value modal__value--notes">{event.notes}</div>
                        </div>
                    )}
                </div>
                <div className="modal__footer">
                    <div className="modal__export-buttons">
                        <button
                            className="btn btn--secondary"
                            onClick={() => shareToCalendar(event)}
                            title="Ajouter à votre calendrier"
                        >
                            <Icons.Calendar /> Ajouter au calendrier
                        </button>
                        <a
                            href={generateGoogleCalendarUrl(event)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--primary"
                        >
                            <Icons.ExternalLink /> Google Calendar
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}

// Next Class Countdown Component
function NextClassCountdown({ events }) {
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [currentEvent, setCurrentEvent] = useState(null);
    const [nextEvent, setNextEvent] = useState(null);

    useEffect(() => {
        const updateCountdown = () => {
            const current = getCurrentEvent(events);
            const next = getNextEvent(events);

            setCurrentEvent(current);
            setNextEvent(next);

            if (current) {
                setTimeRemaining(getTimeRemaining(current.end));
            } else if (next) {
                setTimeRemaining(getTimeRemaining(next.start));
            } else {
                setTimeRemaining(null);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [events]);

    if (!currentEvent && !nextEvent) return null;

    const displayEvent = currentEvent || nextEvent;
    const isOngoing = !!currentEvent;

    return (
        <div className={`countdown-widget ${isOngoing ? 'countdown-widget--ongoing' : ''}`}>
            <div className="countdown-widget__header">
                <Icons.Zap />
                <span>{isOngoing ? 'En cours' : 'Prochain cours'}</span>
            </div>
            <div className="countdown-widget__title">{displayEvent.subjectName}</div>
            <div className="countdown-widget__details">
                {displayEvent.room && <span><Icons.MapPin /> {displayEvent.room}</span>}
                <span><Icons.Clock /> {displayEvent.startTime} - {displayEvent.endTime}</span>
            </div>
            {timeRemaining && (
                <div className="countdown-widget__time">
                    {isOngoing ? 'Fin dans ' : 'Dans '}
                    {timeRemaining.hours > 0 && <span className="countdown-widget__unit">{timeRemaining.hours}<small>h</small></span>}
                    <span className="countdown-widget__unit">{String(timeRemaining.minutes).padStart(2, '0')}<small>m</small></span>
                    <span className="countdown-widget__unit">{String(timeRemaining.seconds).padStart(2, '0')}<small>s</small></span>
                </div>
            )}
        </div>
    );
}

// Weekly Stats Widget Component
function WeeklyStatsWidget({ events, weekDates }) {
    const stats = useMemo(() => getWeeklyStats(events, weekDates), [events, weekDates]);

    if (stats.eventCount === 0) return null;

    const maxDayMinutes = Math.max(...stats.byDay);

    return (
        <div className="stats-widget">
            <div className="stats-widget__header">
                <Icons.BarChart />
                <span>Cette semaine</span>
            </div>
            <div className="stats-widget__summary">
                <div className="stats-widget__stat">
                    <span className="stats-widget__value">{stats.totalHours}</span>
                    <span className="stats-widget__label">heures</span>
                </div>
                <div className="stats-widget__stat">
                    <span className="stats-widget__value">{stats.eventCount}</span>
                    <span className="stats-widget__label">cours</span>
                </div>
            </div>
            <div className="stats-widget__bars">
                {stats.byDay.map((minutes, i) => (
                    <div
                        key={i}
                        className={`stats-widget__bar ${i === new Date().getDay() - 1 ? 'stats-widget__bar--today' : ''}`}
                        style={{ '--bar-height': maxDayMinutes > 0 ? `${(minutes / maxDayMinutes) * 100}%` : '0%' }}
                    >
                        <span className="stats-widget__bar-label">{['L', 'M', 'M', 'J', 'V', 'S', 'D'][i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Event Card Component
function EventCard({ event, onClick }) {
    const color = getSubjectColor(event.subjectName);

    return (
        <div
            className={`event-card ${event.isSecondary ? 'event-card--secondary' : ''}`}
            style={{ '--event-color': color }}
            onClick={() => onClick(event)}
        >
            <div className="event-card__header">
                <h3 className="event-card__title">
                    {event.isSecondary && <span className="event-card__secondary-badge">2</span>}
                    {event.subjectName}
                </h3>
                <span className="event-card__type" style={{ background: color }}>{event.typeLabel}</span>
            </div>
            <div className="event-card__time">
                <Icons.Clock />
                <span>{event.startTime} - {event.endTime}</span>
            </div>
            <div className="event-card__details">
                {event.room && <span className="event-card__detail"><Icons.MapPin />{event.room}</span>}
                {event.staff?.length > 0 && <span className="event-card__detail"><Icons.User />{formatTeachers(event.staff)}</span>}
            </div>
        </div>
    );
}

// Hidden Events Section
function HiddenEventsList({ events, onEventClick }) {
    const [isOpen, setIsOpen] = useState(false);
    if (!events || events.length === 0) return null;

    return (
        <div className="hidden-events">
            <button className="hidden-events__toggle" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                {events.length} cours masqué{events.length > 1 ? 's' : ''} (filtres)
            </button>
            {isOpen && (
                <div className="hidden-events__content">
                    {events.map(event => (
                        <div key={event.id} className="event-card event-card--hidden" onClick={() => onEventClick(event)}>
                            <div className="event-card__header">
                                <h3 className="event-card__title">{event.subjectName}</h3>
                                <span className="event-card__timeIcon" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    <Icons.Clock /> {event.startTime} - {event.endTime}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Month View
function MonthView({ events, selectedDate, onSelectDate, onEventClick }) {
    const { days, weekDays } = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();

        // First day of month
        const firstDay = new Date(year, month, 1);
        // Last day of month
        const lastDay = new Date(year, month + 1, 0);

        // Days to show from prev month (to fill first row)
        // Day 1 (Mon) -> 0 padding, Day 0 (Sun) -> 6 padding
        let paddingStart = firstDay.getDay() - 1;
        if (paddingStart === -1) paddingStart = 6;

        const days = [];

        // Prev month days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = paddingStart - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isOutside: true
            });
        }

        // Current month days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: new Date(year, month, i),
                isOutside: false
            });
        }

        // Next month days (fill to 6 rows = 42 cells)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isOutside: true
            });
        }

        return { days, weekDays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] };
    }, [selectedDate]);

    // Group events by date for fast lookup
    const eventsByDate = useMemo(() => {
        const map = new Map(); // key: "YYYY-MM-DD" -> [events]
        for (const event of events) {
            const key = event.start.toDateString();
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(event);
        }
        return map;
    }, [events]);

    return (
        <div className="month-view">
            <div className="month-header">
                {weekDays.map(d => <div key={d} className="month-header__day">{d}</div>)}
            </div>
            <div className="month-grid">
                {days.map((day, i) => {
                    const dateKey = day.date.toDateString();
                    const dayEvents = eventsByDate.get(dateKey) || [];
                    const isSelected = isSameDay(day.date, selectedDate);
                    const isTodayDate = isToday(day.date);

                    return (
                        <div
                            key={i}
                            className={`month-day ${day.isOutside ? 'month-day--outside' : ''} ${isSelected ? 'month-day--selected' : ''} ${isTodayDate ? 'month-day--today' : ''}`}
                            onClick={() => onSelectDate(day.date)}
                        >
                            <span className="month-day__number">{day.date.getDate()}</span>
                            <div className="month-day__dots">
                                {dayEvents.map((evt, idx) => (
                                    <div
                                        key={evt.id + idx}
                                        className="month-day__dot"
                                        style={{ background: getSubjectColor(evt.subjectName) }}
                                        title={evt.subjectName}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Views
function DayView({ events, hiddenEvents, selectedDate, onEventClick }) {
    const dayEvents = useMemo(() => getEventsForDate(events, selectedDate), [events, selectedDate]);
    const dayHiddenEvents = useMemo(() => getEventsForDate(hiddenEvents, selectedDate), [hiddenEvents, selectedDate]);

    if (dayEvents.length === 0 && dayHiddenEvents.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state__icon"><Icons.AlertCircle /></div>
                <h3 className="empty-state__title">Aucun cours</h3>
                <p>Profite bien !</p>
            </div>
        );
    }

    return (
        <div className="events-list">
            {dayEvents.map(event => <EventCard key={event.id} event={event} onClick={onEventClick} />)}
            <HiddenEventsList events={dayHiddenEvents} onEventClick={onEventClick} />
        </div>
    );
}

function AgendaView({ events, hiddenEvents, onEventClick }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grouped = useMemo(() => {
        const upcoming = events.filter(e => e.start >= today).slice(0, 50);
        const upcomingHidden = hiddenEvents.filter(e => e.start >= today).slice(0, 50);

        const groups = new Map();

        const process = (evs, isHidden) => {
            for (const event of evs) {
                const key = event.start.toDateString();
                if (!groups.has(key)) groups.set(key, { date: event.start, events: [], hidden: [] });
                if (isHidden) groups.get(key).hidden.push(event);
                else groups.get(key).events.push(event);
            }
        };

        process(upcoming, false);
        process(upcomingHidden, true);

        return Array.from(groups.values()).sort((a, b) => a.date - b.date);
    }, [events, hiddenEvents]);

    if (grouped.length === 0) {
        return <div className="empty-state"><div className="empty-state__icon"><Icons.AlertCircle /></div><h3>Aucun cours à venir</h3></div>;
    }

    return (
        <div className="agenda-view">
            {grouped.map(({ date, events, hidden }) => (
                <div key={date.toDateString()} className="agenda-day">
                    <div className="agenda-day__header">
                        <span className="agenda-day__date">
                            {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                        {isToday(date) && <span className="agenda-day__badge">Aujourd'hui</span>}
                    </div>
                    <div className="agenda-day__events" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {events.map(event => <EventCard key={event.id} event={event} onClick={onEventClick} />)}
                        <HiddenEventsList events={hidden} onEventClick={onEventClick} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Week Navigation
function WeekNav({ dates, selectedDate, onSelectDate, events, hideSunday }) {
    const eventCounts = useMemo(() => {
        const counts = new Map();
        for (const event of events) counts.set(event.start.toDateString(), (counts.get(event.start.toDateString()) || 0) + 1);
        return counts;
    }, [events]);

    // Filter out Sundays if hideSunday is enabled
    const displayDates = useMemo(() => {
        if (hideSunday) {
            return dates.filter(date => date.getDay() !== 0); // 0 = Sunday
        }
        return dates;
    }, [dates, hideSunday]);

    return (
        <div className="week-nav">
            {displayDates.map(date => {
                const count = eventCounts.get(date.toDateString()) || 0;
                return (
                    <button
                        key={date.toISOString()}
                        className={`week-day ${isSameDay(date, selectedDate) ? 'active' : ''} ${isToday(date) ? 'today' : ''}`}
                        onClick={() => onSelectDate(date)}
                    >
                        <div className="week-day__name">{formatWeekday(date)}</div>
                        <div className="week-day__num">{date.getDate()}</div>
                        {count > 0 && <div className="week-day__dots">{Array.from({ length: Math.min(count, 3) }).map((_, i) => <span key={i} className="week-day__dot" />)}</div>}
                    </button>
                );
            })}
        </div>
    );
}

// View Mode Selector
function ViewModeSelector({ viewMode, onChange }) {
    const modes = [
        { id: VIEW_MODES.DAY, label: 'Jour', icon: <Icons.Calendar /> },
        { id: VIEW_MODES.AGENDA, label: 'Agenda', icon: <Icons.List /> },
        { id: VIEW_MODES.MONTH, label: 'Mois', icon: <Icons.Calendar /> },
    ];

    const activeIndex = modes.findIndex(m => m.id === viewMode);

    return (
        <div
            className="view-mode-selector view-mode-selector--three"
            style={{ '--active-index': activeIndex }}
        >
            <div className="view-mode-indicator" style={{ opacity: activeIndex === -1 ? 0 : 1 }} />
            {modes.map(({ id, label, icon }) => (
                <button key={id} className={`view-mode-btn ${viewMode === id ? 'active' : ''}`} onClick={() => onChange(id)}>
                    {icon}<span className="view-mode-btn__label">{label}</span>
                </button>
            ))}
        </div>
    );
}

// Tools View - Search, Countdown, Stats
function ToolsView({ events, weekDates, onEventClick }) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter future events matching search
    const searchResults = useMemo(() => {
        const now = new Date();
        const futureEvents = events.filter(e => e.start > now);

        if (!searchQuery.trim()) return [];

        const q = searchQuery.toLowerCase();
        return futureEvents.filter(e => {
            const searchable = [
                e.title, e.subjectName, e.room, e.module, e.notes,
                e.staff?.join(' '),
            ].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(q);
        }).slice(0, 10);
    }, [events, searchQuery]);

    return (
        <div className="tools-view">
            {/* Search Section */}
            <div className="tools-section">
                <h3 className="tools-section__title"><Icons.Search /> Rechercher un cours</h3>
                <div className="tools-search">
                    <input
                        type="text"
                        className="tools-search__input"
                        placeholder="Nom du cours, prof, salle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    {searchQuery && (
                        <button className="tools-search__clear" onClick={() => setSearchQuery('')}>
                            <Icons.X />
                        </button>
                    )}
                </div>

                {searchQuery && (
                    <div className="tools-search__results">
                        {searchResults.length === 0 ? (
                            <p className="tools-search__empty">Aucun cours trouvé</p>
                        ) : (
                            searchResults.map(event => (
                                <EventCard key={event.id} event={event} onClick={onEventClick} />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Countdown Section */}
            <div className="tools-section">
                <h3 className="tools-section__title"><Icons.Zap /> Prochain cours</h3>
                <NextClassCountdown events={events} />
            </div>

            {/* Stats Section */}
            <div className="tools-section">
                <h3 className="tools-section__title"><Icons.BarChart /> Statistiques</h3>
                <WeeklyStatsWidget events={events} weekDates={weekDates} />
            </div>
        </div>
    );
}

// Action Menu Component
function ActionMenu({ isOpen, onClose, onAction }) {
    if (!isOpen) return null;

    return (
        <>
            <div className="action-menu-overlay" onClick={onClose} />
            <div className="action-menu">
                <button
                    className="action-menu__item"
                    onClick={() => onAction('refresh')}
                >
                    <Icons.Refresh /> Rafraîchir
                </button>
                <div className="action-menu__divider" />
                <button
                    className="action-menu__item"
                    onClick={() => onAction('tools')}
                >
                    <Icons.Search /> Outils
                </button>
                <button
                    className="action-menu__item"
                    onClick={() => onAction('filters')}
                >
                    <Icons.Filter /> Filtres
                </button>
                <button
                    className="action-menu__item"
                    onClick={() => onAction('settings')}
                >
                    <Icons.Settings /> Paramètres
                </button>
            </div>
        </>
    );
}

// Setup Screen (when no URL configured)
function SetupScreen({ onSetup }) {
    const [url, setUrl] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) onSetup(url.trim());
    };

    return (
        <div className="setup-screen">
            <div className="setup-screen__content">
                <h1 className="setup-screen__title"><Icons.Calendar /> Bienvenue !</h1>
                <p className="setup-screen__desc">
                    Configure ton calendrier en collant ton lien ICS
                </p>
                <form onSubmit={handleSubmit} className="setup-screen__form">
                    <input
                        type="url"
                        className="settings-input"
                        placeholder="https://... ou webcal://..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn btn--primary btn--full" disabled={!url.trim()}>
                        <Icons.Rocket /> Go
                    </button>
                </form>
                <p className="setup-screen__hint">
                    <Icons.Mail /> Tu peux trouver ton lien ICS dans les paramètres de CELCAT dans exporter en saisissant ton adreese mail universitaire.
                </p>
            </div>
        </div>
    );
}

// Main App
export default function App() {
    const [settings, setSettings] = useState(loadSettings);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [isFromCache, setIsFromCache] = useState(false);
    const [cacheDate, setCacheDate] = useState(null);

    // Save settings on change
    useEffect(() => {
        saveSettings(settings);
    }, [settings]);

    // Load calendar data with cache support and secondary feed
    const loadCalendar = useCallback(async () => {
        if (!settings.icsUrl) return;

        // First, load from cache for immediate display
        const cached = loadCachedEvents(settings.icsUrl);
        if (cached) {
            setEvents(cached.events);
            setIsFromCache(true);
            setCacheDate(cached.cachedAt);
        }

        // Then try to fetch fresh data
        setLoading(true);
        setError(null);
        try {
            // Fetch primary feed
            const primaryData = await fetchCalendarEvents(settings.icsUrl);
            let allEvents = primaryData.map(e => ({ ...e, isSecondary: false }));

            // Fetch secondary feed if configured
            if (settings.secondaryIcsUrl) {
                try {
                    const secondaryData = await fetchCalendarEvents(settings.secondaryIcsUrl);
                    const secondaryEvents = secondaryData.map(e => ({ ...e, isSecondary: true }));
                    allEvents = [...allEvents, ...secondaryEvents].sort((a, b) => a.start - b.start);
                } catch (secErr) {
                    console.warn('Failed to load secondary feed:', secErr);
                }
            }

            // Deduplicate events (check for same ID and Start time)
            const seen = new Set();
            const uniqueEvents = [];
            for (const event of allEvents) {
                const key = `${event.id}_${event.start.getTime()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueEvents.push(event);
                }
            }
            allEvents = uniqueEvents;

            setEvents(allEvents);
            setIsFromCache(false);
            setCacheDate(null);
            // Cache the fresh data
            cacheEvents(allEvents, settings.icsUrl);
        } catch (err) {
            // If we have cached data, don't show error, just keep using cache
            if (!cached) {
                setError(err.message);
            }
            // Keep isFromCache true if we're falling back to cache
        } finally {
            setLoading(false);
        }
    }, [settings.icsUrl, settings.secondaryIcsUrl]);

    useEffect(() => {
        loadCalendar();
    }, [loadCalendar]);

    // Calculate events for filter options
    // We want to show options for all events that are VALID (not banned, correct group)
    // even if they are currently hidden by the user (unchecked in list).
    const filterOptionsEvents = useMemo(() => {
        return events.filter(event => {
            // Respect Banned Patterns
            if (matchesBannedPatterns(event, settings.bannedPatterns)) return false;
            // Respect Group Filter
            if (settings.groupNumber && event.groupNumber && event.groupNumber !== settings.groupNumber) return false;

            return true;
        });
    }, [events, settings.bannedPatterns, settings.groupNumber]);

    // Apply all filters for the view
    const { visible: filteredEvents, hidden: hiddenEvents } = useMemo(() => applyAllFilters(events, settings), [events, settings]);

    // Generate options from the stable list
    const subjects = useMemo(() => getUniqueSubjects(filterOptionsEvents), [filterOptionsEvents]);
    const types = useMemo(() => getUniqueTypes(filterOptionsEvents), [filterOptionsEvents]);
    const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

    // Navigation
    const goToPrevWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    const goToNextWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    const goToToday = () => setSelectedDate(new Date());

    // Day navigation with Sunday skip support
    const goToPrevDay = () => setSelectedDate(d => {
        const n = new Date(d);
        n.setDate(n.getDate() - 1);
        if (settings.hideSunday && n.getDay() === 0) { // If Sunday
            n.setDate(n.getDate() - 1); // Skip to Saturday
        }
        return n;
    });

    const goToNextDay = () => setSelectedDate(d => {
        const n = new Date(d);
        n.setDate(n.getDate() + 1);
        if (settings.hideSunday && n.getDay() === 0) { // If Sunday
            n.setDate(n.getDate() + 1); // Skip to Monday
        }
        return n;
    });

    const goToPrevMonth = () => setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
    const goToNextMonth = () => setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });

    // Auto-redirect if on Sunday and hideSunday is enabled
    useEffect(() => {
        if (settings.hideSunday && selectedDate.getDay() === 0 && settings.viewMode === VIEW_MODES.DAY) {
            // Move to Monday
            setSelectedDate(d => {
                const n = new Date(d);
                n.setDate(n.getDate() + 1);
                return n;
            });
        }
    }, [settings.hideSunday, selectedDate, settings.viewMode]);

    const handlePrev = () => {
        if (settings.viewMode === VIEW_MODES.MONTH) goToPrevMonth();
        else goToPrevWeek();
    };

    const handleNext = () => {
        if (settings.viewMode === VIEW_MODES.MONTH) goToNextMonth();
        else goToNextWeek();
    };

    // Swipe gestures

    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const touchZone = useRef(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;

        // Identify the zone
        if (e.target.closest('.main')) {
            touchZone.current = 'main';
        } else if (e.target.closest('.date-nav')) {
            touchZone.current = 'date-nav';
        } else {
            touchZone.current = null;
        }
    };

    const onTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (settings.viewMode === VIEW_MODES.DAY) {
            if (touchZone.current === 'main') {
                if (isLeftSwipe) goToNextDay();
                if (isRightSwipe) goToPrevDay();
            } else if (touchZone.current === 'date-nav') {
                if (isLeftSwipe) handleNext();
                if (isRightSwipe) handlePrev();
            }
        } else if (settings.viewMode === VIEW_MODES.MONTH) {
            if (touchZone.current === 'main' || touchZone.current === 'date-nav') {
                if (isLeftSwipe) goToNextMonth();
                if (isRightSwipe) goToPrevMonth();
            }
        }

        // Reset touches to prevent double firing
        touchStart.current = null;
        touchEnd.current = null;
    };

    // Handle initial setup
    const handleSetup = (url) => {
        setSettings(prev => ({ ...prev, icsUrl: url }));
    };

    // Show setup screen if no URL
    if (!settings.icsUrl) {
        return <SetupScreen onSetup={handleSetup} />;
    }

    return (
        <div
            className="app"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <header className="header">
                <div>
                    <h1 className="header__title"><Icons.Calendar /> Mon Calendrier</h1>
                    <p className="header__date">{formatDateHeader(selectedDate)}</p>
                    {isFromCache && (
                        <span
                            className="cache-badge"
                            title={cacheDate ? `Données du ${cacheDate.toLocaleString('fr-FR')}` : 'Données en cache'}
                        >
                            📦 Hors ligne
                        </span>
                    )}
                </div>
                <div className="header__actions" style={{ position: 'relative' }}>
                    <button
                        className={`btn btn--icon ${isActionMenuOpen ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                        title="Menu"
                    >
                        <Icons.MoreVertical />
                    </button>

                    <ActionMenu
                        isOpen={isActionMenuOpen}
                        onClose={() => setIsActionMenuOpen(false)}
                        onAction={(action) => {
                            setIsActionMenuOpen(false);
                            if (action === 'refresh') loadCalendar();
                            if (action === 'tools') setSettings(s => ({ ...s, viewMode: VIEW_MODES.TOOLS }));
                            if (action === 'filters') setIsFilterOpen(true);
                            if (action === 'settings') setIsSettingsOpen(true);
                        }}
                    />
                </div>
            </header>

            <ViewModeSelector viewMode={settings.viewMode} onChange={(m) => setSettings(s => ({ ...s, viewMode: m }))} />

            {settings.viewMode === VIEW_MODES.DAY && (
                <div style={{ padding: '0 var(--space-md)' }}>
                    <div className="date-nav">
                        <button className="date-nav__btn" onClick={handlePrev}><Icons.ChevronLeft /></button>
                        <div className="date-nav__current">
                            <div className="date-nav__day">{selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                            {!isToday(selectedDate) && <div className="date-nav__today" onClick={goToToday}>Aujourd'hui</div>}
                        </div>
                        <button className="date-nav__btn" onClick={handleNext}><Icons.ChevronRight /></button>
                    </div>
                    {settings.viewMode === VIEW_MODES.DAY && (
                        <WeekNav dates={weekDates} selectedDate={selectedDate} onSelectDate={setSelectedDate} events={filteredEvents} hideSunday={settings.hideSunday} />
                    )}
                </div>
            )}

            {settings.viewMode === VIEW_MODES.MONTH && (
                <div style={{ padding: '0 var(--space-md)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="date-nav">
                        <button className="date-nav__btn" onClick={handlePrev}><Icons.ChevronLeft /></button>
                        <div className="date-nav__current">
                            <div className="date-nav__day">{selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                            {!isToday(selectedDate) && <div className="date-nav__today" onClick={goToToday}>Aujourd'hui</div>}
                        </div>
                        <button className="date-nav__btn" onClick={handleNext}><Icons.ChevronRight /></button>
                    </div>
                    <MonthView
                        events={filteredEvents}
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                            setSelectedDate(date);
                            setSettings(s => ({ ...s, viewMode: VIEW_MODES.DAY }));
                        }}
                        onEventClick={setSelectedEvent}
                    />
                </div>
            )}

            <main className="main" style={{ display: settings.viewMode === VIEW_MODES.MONTH ? 'none' : undefined }}>
                {loading && events.length === 0 ? (
                    <div className="loading"><div className="loading__spinner" /><p>Chargement...</p></div>
                ) : error ? (
                    <div className="empty-state">
                        <div className="empty-state__icon"><Icons.AlertCircle /></div>
                        <h3 className="empty-state__title">Erreur !</h3>
                        <p>{error}</p>
                        <button className="btn btn--primary" onClick={loadCalendar}>Réessayer</button>
                    </div>
                ) : settings.viewMode === VIEW_MODES.TOOLS ? (
                    <ToolsView
                        events={filteredEvents}
                        weekDates={weekDates}
                        onEventClick={setSelectedEvent}
                    />
                ) : settings.viewMode === VIEW_MODES.MONTH ? (
                    null
                ) : settings.viewMode === VIEW_MODES.DAY ? (
                    <DayView
                        events={filteredEvents}
                        hiddenEvents={hiddenEvents}
                        selectedDate={selectedDate}
                        onEventClick={setSelectedEvent}
                    />
                ) : (
                    <AgendaView
                        events={filteredEvents}
                        hiddenEvents={hiddenEvents}
                        onEventClick={setSelectedEvent}
                    />
                )}
            </main>

            <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onSettingsChange={setSettings}
                onReload={loadCalendar}
            />

            <FilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                subjects={subjects}
                types={types}
                settings={settings}
                onSettingsChange={setSettings}
            />

            <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </div>
    );
}
