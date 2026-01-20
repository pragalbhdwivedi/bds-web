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
      const matcher = new RegExp(dateRule.calendarMatch, 'i');
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

  const response = await fetch(icsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS: ${response.status}`);
  }
  const icsText = await response.text();
  const icsEvents = parseIcsEvents(icsText);

  const resolvedEvents = buildResolvedEvents(rulesData.events || [], icsEvents);

  const output = {
    generatedAt: new Date().toISOString(),
    window: rulesData.window,
    priorityOrder: rulesData.priorityOrder,
    resolvedEvents,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
};

await main();
