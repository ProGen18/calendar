/**
 * ICS Parser & Data Processor
 * Optimized for CELCAT calendar format
 */

const ICS_URL = 'https://extra.u-picardie.fr/celcat-feed/ical/AQ13FQGL3814385/schedule.ics';

// Color palette for subjects (contrast-safe)
const COLORS = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f43f5e', // Rose
    '#84cc16', // Lime
    '#0ea5e9', // Sky
    '#d946ef', // Fuchsia
    '#14b8a6', // Teal
    '#fb923c', // Orange
];

/**
 * Generate a consistent color for a subject name
 */
function getSubjectColor(subjectName) {
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
        hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Parse event type from title (CM, TD, TP, etc.)
 */
function parseEventType(title, description) {
    const typePatterns = [
        { pattern: /\bCM\b/i, type: 'CM', label: 'Cours' },
        { pattern: /\bTD\b/i, type: 'TD', label: 'TD' },
        { pattern: /\bTP\b/i, type: 'TP', label: 'TP' },
        { pattern: /\bExamen\b/i, type: 'EXAM', label: 'Examen' },
        { pattern: /\bDS\b/i, type: 'EXAM', label: 'DS' },
        { pattern: /\bPartiel\b/i, type: 'EXAM', label: 'Partiel' },
        { pattern: /\bFérié\b/i, type: 'HOLIDAY', label: 'Férié' },
    ];

    const combined = `${title} ${description || ''}`;

    for (const { pattern, type, label } of typePatterns) {
        if (pattern.test(combined)) {
            return { type, label };
        }
    }

    return { type: 'OTHER', label: 'Autre' };
}

/**
 * Extract clean subject name (remove type suffixes)
 */
function extractSubjectName(title) {
    return title
        .replace(/;\s*(CM|TD|TP|Examen|DS|Partiel)\s*/gi, '')
        .replace(/\s*(CM|TD|TP|Examen|DS|Partiel)\s*$/gi, '')
        .trim();
}

/**
 * Parse description field from CELCAT format
 */
function parseDescription(rawDescription) {
    if (!rawDescription) return {};

    const result = {
        department: null,
        category: null,
        group: null,
        module: null,
        staff: [],
        room: null,
        notes: null,
    };

    const lines = rawDescription.split(/\\n|\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        switch (key.toLowerCase()) {
            case 'department':
                result.department = value;
                break;
            case 'event category':
                result.category = value;
                break;
            case 'group':
                result.group = value;
                break;
            case 'module':
                result.module = value;
                break;
            case 'staff':
                result.staff = value.split(';').map(s => s.trim()).filter(Boolean);
                break;
            case 'room':
                result.room = value;
                break;
            case 'notes':
                result.notes = value;
                break;
        }
    }

    return result;
}

/**
 * Extract group number from notes or group field
 */
function extractGroupNumber(parsedDesc) {
    const groupPatterns = [
        /groupe\s*(\d+)/i,
        /gr\.?\s*(\d+)/i,
        /g(\d+)/i,
    ];

    const searchText = `${parsedDesc.notes || ''} ${parsedDesc.group || ''}`;

    for (const pattern of groupPatterns) {
        const match = searchText.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    return null;
}

/**
 * Check if event matches a specific group
 */
function matchesGroup(event, targetGroup) {
    if (!targetGroup) return true;
    if (!event.groupNumber) return true; // No group = show to everyone
    return event.groupNumber === targetGroup;
}

/**
 * Transform raw ICS event to clean format
 */
function transformEvent(rawEvent) {
    const parsedDesc = parseDescription(rawEvent.description);
    const eventType = parseEventType(rawEvent.summary, rawEvent.description);
    const subjectName = extractSubjectName(rawEvent.summary || 'Sans titre');
    const groupNumber = extractGroupNumber(parsedDesc);

    const start = rawEvent.start instanceof Date ? rawEvent.start : new Date(rawEvent.start);
    const end = rawEvent.end instanceof Date ? rawEvent.end : new Date(rawEvent.end);

    return {
        id: rawEvent.uid || `${start.getTime()}-${subjectName}`,
        title: rawEvent.summary || 'Sans titre',
        subjectName,
        type: eventType.type,
        typeLabel: eventType.label,
        start,
        end,
        startTime: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        endTime: end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        duration: Math.round((end - start) / (1000 * 60)), // in minutes
        room: parsedDesc.room,
        staff: parsedDesc.staff,
        group: parsedDesc.group,
        groupNumber,
        notes: parsedDesc.notes,
        module: parsedDesc.module || subjectName,
        color: getSubjectColor(subjectName),
        isHoliday: eventType.type === 'HOLIDAY',
    };
}

/**
 * Fetch and parse ICS from URL with CORS handling
 * @param {string} icsUrl - The ICS calendar URL to fetch
 */
export async function fetchCalendarEvents(icsUrl) {
    if (!icsUrl) {
        throw new Error('Aucune URL de calendrier configurée. Allez dans les paramètres.');
    }

    // Convert webcal:// to https://
    const normalizedUrl = icsUrl.replace(/^webcal:\/\//i, 'https://');

    // Try different methods to fetch the ICS
    const fetchMethods = [
        // Method 1: Direct fetch (if CORS is allowed)
        async () => {
            const response = await fetch(normalizedUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        },
        // Method 2: CORS proxy (allorigins)
        async () => {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        },
        // Method 3: Alternative CORS proxy (corsproxy.io)
        async () => {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        },
    ];

    for (const method of fetchMethods) {
        try {
            const icsText = await method();
            if (icsText && icsText.includes('BEGIN:VCALENDAR')) {
                return parseICS(icsText);
            }
        } catch (e) {
            console.log('Fetch method failed, trying next...', e.message);
        }
    }

    throw new Error('Impossible de charger le calendrier. Vérifiez l\'URL ou votre connexion.');
}

/**
 * Parse raw ICS text to events array
 */
function parseICS(icsText) {
    const events = [];
    const lines = icsText.split(/\r?\n/);

    let currentEvent = null;
    let currentField = null;
    let currentValue = '';

    for (const line of lines) {
        // Handle line continuations (lines starting with space or tab)
        if (line.startsWith(' ') || line.startsWith('\t')) {
            currentValue += line.substring(1);
            continue;
        }

        // Process previous field if exists
        if (currentField && currentEvent) {
            processField(currentEvent, currentField, currentValue);
        }

        // Parse new field
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        let fieldName = line.substring(0, colonIndex);
        currentValue = line.substring(colonIndex + 1);

        // Handle field parameters (e.g., DTSTART;TZID=...)
        const semiIndex = fieldName.indexOf(';');
        if (semiIndex !== -1) {
            fieldName = fieldName.substring(0, semiIndex);
        }

        currentField = fieldName;

        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
            currentField = null;
        } else if (line.startsWith('END:VEVENT') && currentEvent) {
            if (currentEvent.start) {
                events.push(transformEvent(currentEvent));
            }
            currentEvent = null;
            currentField = null;
        }
    }

    // Sort by start date
    return events.sort((a, b) => a.start - b.start);
}

function processField(event, field, value) {
    switch (field) {
        case 'SUMMARY':
            event.summary = unescapeICS(value);
            break;
        case 'DESCRIPTION':
            event.description = unescapeICS(value);
            break;
        case 'DTSTART':
            event.start = parseICSDate(value);
            break;
        case 'DTEND':
            event.end = parseICSDate(value);
            break;
        case 'LOCATION':
            event.location = unescapeICS(value);
            break;
        case 'UID':
            event.uid = value;
            break;
    }
}

function parseICSDate(dateStr) {
    // Format: 20241231T120000 or 20241231T120000Z
    const cleaned = dateStr.replace(/[:-]/g, '');

    if (cleaned.length >= 15) {
        const year = parseInt(cleaned.substring(0, 4), 10);
        const month = parseInt(cleaned.substring(4, 6), 10) - 1;
        const day = parseInt(cleaned.substring(6, 8), 10);
        const hour = parseInt(cleaned.substring(9, 11), 10);
        const minute = parseInt(cleaned.substring(11, 13), 10);
        const second = parseInt(cleaned.substring(13, 15), 10);

        if (cleaned.endsWith('Z')) {
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        }
        return new Date(year, month, day, hour, minute, second);
    }

    // All-day event (YYYYMMDD)
    if (cleaned.length === 8) {
        const year = parseInt(cleaned.substring(0, 4), 10);
        const month = parseInt(cleaned.substring(4, 6), 10) - 1;
        const day = parseInt(cleaned.substring(6, 8), 10);
        return new Date(year, month, day);
    }

    return new Date(dateStr);
}

function unescapeICS(str) {
    return str
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

/**
 * Get unique subjects from events
 */
export function getUniqueSubjects(events) {
    const subjects = new Map();

    for (const event of events) {
        if (!subjects.has(event.subjectName)) {
            subjects.set(event.subjectName, {
                name: event.subjectName,
                color: event.color,
                count: 0,
            });
        }
        subjects.get(event.subjectName).count++;
    }

    return Array.from(subjects.values()).sort((a, b) => b.count - a.count);
}

/**
 * Get unique event types
 */
export function getUniqueTypes(events) {
    const types = new Map();

    for (const event of events) {
        if (!types.has(event.type)) {
            types.set(event.type, {
                type: event.type,
                label: event.typeLabel,
                count: 0,
            });
        }
        types.get(event.type).count++;
    }

    return Array.from(types.values());
}

/**
 * Filter events based on criteria
 */
export function filterEvents(events, filters) {
    return events.filter(event => {
        // Hidden subjects
        if (filters.hiddenSubjects?.has(event.subjectName)) {
            return false;
        }

        // Hidden types
        if (filters.hiddenTypes?.has(event.type)) {
            return false;
        }

        // Group filter
        if (filters.groupNumber && event.groupNumber && event.groupNumber !== filters.groupNumber) {
            return false;
        }

        // Search query
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const searchable = `${event.title} ${event.module} ${event.staff?.join(' ')} ${event.room || ''}`.toLowerCase();
            if (!searchable.includes(query)) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(events, date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return events.filter(event => event.start >= dayStart && event.start <= dayEnd);
}

/**
 * Get week dates from a reference date
 */
export function getWeekDates(date) {
    const result = [];
    const current = new Date(date);

    // Find Monday of this week
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    current.setDate(diff);

    for (let i = 0; i < 7; i++) {
        result.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return result;
}
