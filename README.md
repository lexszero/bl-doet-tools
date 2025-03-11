## What?

[Design doc](https://docs.google.com/document/d/1DeT0Up7U0pd_Xm0Yh2bo6wCkEN9P7T_iHX4mlOrJKzw/edit?tab=t.0)

## How to run

### Power map API

    pipenv install
    pipenv run uvicorn --reload app.main:app

### Web UI

    cd doet-web-ui
    npm install
    npm run dev     # to develop locally
    npm run build   # to build for deployment

## What's inside?

* `app` - main API service runner (Python/FastAPI)
* `common` - ignore it for now
* `doet-web-ui` - Web UI experiment (Svelte/SvelteKit)
* `power_map` - Power map data stuff (Python/FastAPI)
