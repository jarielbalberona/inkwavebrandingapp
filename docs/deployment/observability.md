# Observability Baseline

This app does not have real monitoring yet. It has a sane minimum:

- one request ID per HTTP request
- one structured completion log per request
- one structured error log for uncaught request failures
- safe client-facing `500` responses that do not dump internals

If somebody claims that is “full observability,” they are lying. It is only enough to debug the first wave of deployment and API incidents.

## Current Log Events

The API currently emits JSON logs for:

- `api_server_started`
- `http_request_completed`
- `http_request_failed`

Fields include:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`

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
