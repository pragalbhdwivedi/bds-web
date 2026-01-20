# BDSPS Website

This repository contains the static website for Badridhar Dwivedi Smriti Public School (BDSPS).

## Structure
- `index.html`: Home page
- `about/`, `academics/`, `admissions/`, `infrastructure/`, `contact/`, `news-events/`: Section pages
- `mandatory-public-disclosure/`: CBSE-required disclosure pages and PDF links
- `assets/`: Shared styles, scripts, and images
- `documents/`: Public PDF documents

## Local preview
Run a local server from the repo root:

```bash
python -m http.server 8000
```

Then open http://127.0.0.1:8000/ in your browser.

## Festival theme generator
The festival theme data is generated daily from a Google Calendar ICS feed.

### Set the CAL_ICS_URL secret
1. Open the repository **Settings → Secrets and variables → Actions**.
2. Add a new repository secret named `CAL_ICS_URL` with the public or private ICS feed URL.

### Trigger the workflow manually
1. Go to the **Actions** tab.
2. Select **Update festival data**.
3. Click **Run workflow**.

### Update festivals in Google Calendar
1. Add or edit events in the source calendar.
2. Ensure event titles match the `calendarMatch` regex in `assets/themes/festivals.json`.
3. All-day events should use date-only start/end fields in the calendar entry.

### Add new theme IDs
1. Create a new theme style in `assets/css/style.css` using `html[data-festival="<theme-id>"]`.
2. Add or update festival rules in `assets/themes/festivals.json` with the new `themeId`.
3. Run the generator or wait for the scheduled workflow to update `festivals.generated.json`.
