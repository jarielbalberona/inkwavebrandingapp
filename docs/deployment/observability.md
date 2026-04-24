# Observability Baseline

This app does not have real monitoring yet. It has a sane minimum:

- one request ID per HTTP request
- one structured completion log per request
- one structured error log for uncaught request failures
- safe client-facing `500` responses that do not dump internals

If somebody claims that is “full observability,” they are lying. It is only enough to debug the first wave of deployment and API incidents.

## Current Log Events

The API uses [Pino](https://github.com/pinojs/pino) and emits JSON logs to stdout for:

- `api_server_started`
- `http_request_completed`
- `http_request_failed`

Set `LOG_LEVEL` on the API service (e.g. `debug`, `info`, `warn`, `error`) to tune verbosity. Defaults: `info` when `NODE_ENV=production`, otherwise `debug`.

Fields include:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`

For `statusCode >= 500`, the line is written at `error` level and may add:

- `clientError` — bounded copy of the JSON error returned to the client (`error`, `code`, `column`, `table`, `detail`, `constraint` when present)
- `unhandledError` — `name` / `message` / `stack` when the request failed in the outer `catch` (rare; most route modules handle errors and respond with 500 + JSON without throwing)

Startup logs also report only safe booleans such as whether database config, Sentry config, and web origin config are present. They do not print the secret values.

## Where To Inspect Logs

- local development: terminal output from `pnpm --filter @workspace/api dev`
- Render API service: service logs in the Render dashboard

If a browser request fails, start with the `X-Request-Id` response header and find the matching API log line. That is faster than guessing.

## Things We Do Not Log Deliberately

- passwords
- session secrets
- database URLs
- full customer contact payloads
- pricing/cost payload dumps

If debugging requires that kind of data, the logging design is wrong and needs a narrower targeted fix, not a bigger firehose.
