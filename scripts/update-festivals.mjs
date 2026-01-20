import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const festivalsPath = path.join(rootDir, 'assets', 'themes', 'festivals.json');
const outputPath = path.join(rootDir, 'assets', 'themes', 'festivals.generated.json');

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, offset) => {
  const result = new Date(date);
  result.setDate(result.getDate() + offset);
  return result;
};

const addMonths = (date, offset) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + offset, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

const parseIcsDate = (value) => {
  if (!value) {
    return null;
  }
  const match = String(value).match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const unfoldLines = (text) => {
  const lines = text.split(/\r?\n/);
  const unfolded = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
};

const parseIcsEvents = (text) => {
  const events = [];
  const lines = unfoldLines(text);
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.summary && current?.startDate) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (!current || !line.includes(':')) {
      continue;
    }

    const [rawKey, rawValue] = line.split(/:(.*)/s);
    const value = rawValue?.trim();
    const key = rawKey.split(';')[0];
    const params = rawKey.split(';').slice(1).join(';');

    if (key === 'SUMMARY') {
      current.summary = value;
      continue;
    }

    if (key === 'DTSTART') {
      const date = parseIcsDate(value);
      if (date) {
        current.startDate = startOfDay(date);
        current.isAllDay = params.includes('VALUE=DATE');
      }
      continue;
    }

    if (key === 'DTEND') {
      const date = parseIcsDate(value);
      if (date) {
        current.endDate = startOfDay(date);
        current.isEndAllDay = params.includes('VALUE=DATE');
      }
    }
  }

  return events.map((event) => {
    if (!event.endDate) {
      return { ...event, endDate: event.startDate };
    }
    if (event.isEndAllDay) {
      return { ...event, endDate: addDays(event.endDate, -1) };
    }
    return event;
  });
};

const assertValid = (condition, message) => {
  if (!condition) {
    throw new Error(`Invalid festivals.json: ${message}`);
  }
};

const validateRulesData = (data) => {
  assertValid(data && typeof data === 'object', 'root object is missing.');
  assertValid(data.window && typeof data.window === 'object', '`window` is missing.');
  assertValid(
    Number.isInteger(data.window.daysBefore) && Number.isInteger(data.window.daysAfter),
    '`window.daysBefore` and `window.daysAfter` must be integers.',
  );
  assertValid(Array.isArray(data.priorityOrder), '`priorityOrder` must be an array.');
  assertValid(Array.isArray(data.events), '`events` must be an array.');
  data.events.forEach((event, index) => {
    assertValid(event.id && event.name, `event at index ${index} must include id and name.`);
    assertValid(event.importance, `event ${event.id} missing importance.`);
    assertValid(event.themeId, `event ${event.id} missing themeId.`);
    assertValid(event.dateRule && event.dateRule.type, `event ${event.id} missing dateRule.`);
  });
};

const validateResolvedEvents = (events) => {
  if (!Array.isArray(events)) {
    throw new Error('Resolved events must be an array.');
  }
  events.forEach((event) => {
    if (!event.id || !event.name || !event.importance || !event.themeId) {
      throw new Error(`Resolved event missing fields: ${JSON.stringify(event)}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate)) {
      throw new Error(`Resolved event has invalid dates: ${event.id}`);
    }
  });
};

const buildResolvedEvents = (rules, icsEvents) => {
  const today = startOfDay(new Date());
  const windowEnd = addMonths(today, 18);
  const resolved = [];

  for (const rule of rules) {
    const { dateRule } = rule;
    if (!dateRule) {
      continue;
    }

    if (dateRule.type === 'calendar') {
      let matcher;
      try {
        matcher = new RegExp(dateRule.calendarMatch, 'i');
      } catch (error) {
        throw new Error(`Invalid calendarMatch regex for ${rule.id}.`);
      }
      const matches = icsEvents
        .filter((event) => matcher.test(event.summary ?? ''))
        .filter((event) => event.startDate >= today && event.startDate <= windowEnd)
        .sort((a, b) => a.startDate - b.startDate);
      const nextEvent = matches[0];
      if (nextEvent) {
        resolved.push({
          id: rule.id,
          name: rule.name,
          importance: rule.importance,
          themeId: rule.themeId,
          startDate: toIsoDate(nextEvent.startDate),
          endDate: toIsoDate(nextEvent.endDate),
        });
      }
      continue;
    }

    if (dateRule.type === 'fixed') {
      const years = [today.getFullYear(), today.getFullYear() + 1];
      for (const year of years) {
        const startDate = new Date(year, dateRule.month - 1, dateRule.day);
        resolved.push({
          id: rule.id,
          name: rule.name,
          importance: rule.importance,
          themeId: rule.themeId,
          startDate: toIsoDate(startDate),
          endDate: toIsoDate(startDate),
        });
      }
    }
  }

  return resolved.sort((a, b) => {
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate);
    }
    return a.id.localeCompare(b.id);
  });
};

const main = async () => {
  const icsUrl = process.env.CAL_ICS_URL;
  if (!icsUrl) {
    throw new Error('CAL_ICS_URL env var is required.');
  }

  const rawRules = await readFile(festivalsPath, 'utf8');
  const rulesData = JSON.parse(rawRules);
  validateRulesData(rulesData);

  const response = await fetch(icsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS: ${response.status}`);
  }
  const icsText = await response.text();
  const icsEvents = parseIcsEvents(icsText);

  const resolvedEvents = buildResolvedEvents(rulesData.events || [], icsEvents);
  validateResolvedEvents(resolvedEvents);

  const output = {
    generatedAt: new Date().toISOString(),
    window: rulesData.window,
    priorityOrder: rulesData.priorityOrder,
    resolvedEvents,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
};

await main();
