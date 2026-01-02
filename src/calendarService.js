/**
 * ICS Parser & Data Processor
 * Optimized for CELCAT calendar format
 */
// Color palette for subjects (contrast-safe)
const COLORS = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f43f5e', // Rosee
    '#84cc16', // Lime
    '#0ea5e9', // Sky
    '#d946ef', // Fuchsia
    '#14b8a6', // Teal
    '#fb923c', // Orange
];

// Cache storage key
const CACHE_KEY = 'celcat-calendar-cache';

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
 * Extract clean subject name
 * Handles Hyperplanning format: "A311 Atelier de projet - GIVELET - Gpe 5"
 * Returns just the subject name: "Atelier de projet"
 */
function extractSubjectName(title, parsedDesc) {
    if (!title) return 'Sans titre';

    let cleaned = title;

    // First, try to use module/matière from description if available (most reliable)
    if (parsedDesc?.module) {
        // Remove any code prefix from module too (e.g., "A313 Représentations Architect" -> "Représentations Architect")
        const moduleClean = parsedDesc.module.replace(/^[A-Z]{1,4}[-]?\d{2,4}\s+/i, '').trim();
        if (moduleClean) return moduleClean;
    }

    // Hyperplanning format: "CODE Subject - Teacher - Group"
    // Split by " - " and take the first part, then remove the code
    const parts = cleaned.split(' - ');
    if (parts.length > 1) {
        // Take first part (code + subject)
        cleaned = parts[0];
    }

    // Remove module code prefix patterns:
    // A311, A312, AP332, ECO-03, R104, M4206, etc.
    cleaned = cleaned
        .replace(/^[A-Z]{1,4}[-]?\d{2,4}\s+/i, '')  // A311, AP332, R104, M4206
        .replace(/^[A-Z]{2,4}-\d{2}\s+\d{2}\s+/i, '')  // ECO-03 03 (remove duplicate number)
        .trim();

    // Remove type suffixes (CM, TD, TP, etc.)
    cleaned = cleaned
        .replace(/;\s*(CM|TD|TP|Examen|DS|Partiel)\s*/gi, '')
        .replace(/\s*(CM|TD|TP|Examen|DS|Partiel)\s*$/gi, '')
        .trim();

    return cleaned || 'Sans titre';
}

/**
 * Extract module code from title (A311, ECO-03, etc.)
 */
function extractModuleCode(title) {
    if (!title) return null;

    // Match patterns: A311, AP332, R104, M4206, ECO-03
    const codeMatch = title.match(/^([A-Z]{1,4}[-]?\d{2,4})/i);
    return codeMatch ? codeMatch[1] : null;
}

/**
 * Split a value using multiple possible separators
 * Handles: escaped commas (\,), pipes (|), semicolons (;), regular commas
 */
function splitMultiValue(value) {
    if (!value) return [];

    // First, handle escaped commas by replacing with placeholder
    const placeholder = '<<COMMA>>';
    let processed = value.replace(/\\,/g, placeholder);

    // Try different separators
    let parts;
    if (processed.includes('|')) {
        parts = processed.split('|');
    } else if (processed.includes(';')) {
        parts = processed.split(';');
    } else if (processed.includes(',')) {
        parts = processed.split(',');
    } else {
        parts = [processed];
    }

    // Restore escaped commas and clean up
    return parts
        .map(p => p.replace(new RegExp(placeholder, 'g'), ',').trim())
        .filter(Boolean);
}

/**
 * Parse description field - supports CELCAT (English) and Hyperplanning (French) formats
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
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Normalize key to lowercase for matching
        const keyLower = key.toLowerCase();

        // CELCAT English labels
        if (keyLower === 'department') {
            result.department = value;
        } else if (keyLower === 'event category') {
            result.category = value;
        } else if (keyLower === 'group') {
            result.group = value;
        } else if (keyLower === 'module') {
            result.module = value;
        } else if (keyLower === 'staff') {
            result.staff = splitMultiValue(value);
        } else if (keyLower === 'room') {
            result.room = value;
        } else if (keyLower === 'notes') {
            result.notes = value;
        }
        // Hyperplanning French labels
        else if (keyLower === 'matière') {
            result.module = value;
        } else if (keyLower === 'enseignant' || keyLower === 'enseignants') {
            result.staff = splitMultiValue(value);
        } else if (keyLower === 'promotion' || keyLower === 'td' || keyLower === 'promotions') {
            result.group = value;
        } else if (keyLower === 'salle' || keyLower === 'salles') {
            result.room = splitMultiValue(value).join(', ');
        }
    }

    return result;
}

/**
 * Extract group number from notes, group field, or categories
 */
function extractGroupNumber(parsedDesc, categories) {
    const groupPatterns = [
        /groupe\s*(\d+)/i,
        /gr\.?\s*(\d+)/i,
        /gpe\s*(\d+)/i,
        /g(\d+)/i,
        /S\d+G(\d+)/i,  // ADE format: S1G1, S4G2
    ];

    const searchText = `${parsedDesc.notes || ''} ${parsedDesc.group || ''} ${categories || ''}`;

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
 * Supports CELCAT, ADE Campus, and Hyperplanning formats
 */
function transformEvent(rawEvent) {
    const parsedDesc = parseDescription(rawEvent.description);
    const eventType = parseEventType(rawEvent.summary, rawEvent.description);

    // Extract clean subject name (uses description module if available)
    const subjectName = extractSubjectName(rawEvent.summary, parsedDesc);

    // Extract module code (A311, ECO-03, etc.)
    const moduleCode = extractModuleCode(rawEvent.summary);

    // Multi-source group detection: CATEGORIES (ADE) > Description
    const groupNumber = extractGroupNumber(parsedDesc, rawEvent.categories);

    // Multi-source room detection: Description > LOCATION field
    const room = parsedDesc.room || rawEvent.location || null;

    const start = rawEvent.start instanceof Date ? rawEvent.start : new Date(rawEvent.start);
    const end = rawEvent.end instanceof Date ? rawEvent.end : new Date(rawEvent.end);

    return {
        id: rawEvent.uid || `${start.getTime()}-${subjectName}`,
        title: subjectName,  // Use clean subject name as title
        subjectName,
        type: eventType.type,
        typeLabel: eventType.label,
        start,
        end,
        startTime: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        endTime: end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        duration: Math.round((end - start) / (1000 * 60)), // in minutes
        room,
        staff: parsedDesc.staff,
        group: parsedDesc.group || rawEvent.categories,
        groupNumber,
        notes: parsedDesc.notes,
        module: parsedDesc.module || subjectName,
        moduleCode,  // Code du bloc (A311, ECO-03, etc.)
        categories: rawEvent.categories,
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
        case 'CATEGORIES':
            event.categories = value;
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

/**
 * Save events to localStorage cache
 * @param {Array} events - Events to cache
 * @param {string} icsUrl - The URL they were fetched from
 */
export function cacheEvents(events, icsUrl) {
    try {
        const cacheData = {
            events: events.map(e => ({
                ...e,
                start: e.start.toISOString(),
                end: e.end.toISOString(),
            })),
            icsUrl,
            cachedAt: new Date().toISOString(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
        console.warn('Failed to cache events:', e);
    }
}

/**
 * Load events from localStorage cache
 * @param {string} icsUrl - The current ICS URL (must match cached URL)
 * @returns {Object|null} Cached data with events array and cachedAt date, or null
 */
export function loadCachedEvents(icsUrl) {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const data = JSON.parse(cached);
        // Verify cache matches current URL
        if (data.icsUrl !== icsUrl) return null;

        return {
            events: data.events.map(e => ({
                ...e,
                start: new Date(e.start),
                end: new Date(e.end),
            })),
            cachedAt: new Date(data.cachedAt),
        };
    } catch (e) {
        console.warn('Failed to load cached events:', e);
        return null;
    }
}
