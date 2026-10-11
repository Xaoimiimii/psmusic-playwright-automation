import { test, type APIRequestContext, type APIResponse, type Request } from '@playwright/test';
import { recordFailureSignal, recordLayer } from './test-observations';
import { redactHeader, redactHeaders, redactJson, redactText, truncate } from './redaction';

/** Larger bodies (song lists) are cut in the attachment; the test still reads the full response. */
const MAX_BODY_LENGTH = 16_000;

const HTTP_METHODS: readonly PropertyKey[] = ['fetch', 'get', 'post', 'put', 'patch', 'delete', 'head'];

type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;

/**
 * The request context with every HTTP call reported in Allure: one step named
 * `METHOD /path` holding an "HTTP exchange" attachment (method, URL, duration,
 * status, headers and bodies with credentials masked). Responses are returned
 * unchanged, so API clients and assertions keep working as before.
 *
 * Shows the headers the caller passed; cookies the context's jar adds are not visible here.
 * `precondition: true` marks set-up traffic (registering or signing in a test
 * user), which does not make the test an API-layer test.
 */
export function withApiReporting(request: APIRequestContext, { precondition = false } = {}): APIRequestContext {
  return new Proxy(request, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (!HTTP_METHODS.includes(property)) return value.bind(target);
      return (urlOrRequest: string | Request, options: RequestOptions = {}) => {
        const method = property === 'fetch' ? requestMethod(urlOrRequest, options) : String(property).toUpperCase();
        const send = () => (value as APIRequestContext['fetch']).call(target, urlOrRequest, options);
        if (!precondition) recordLayer('API');
        return reportedCall(method, urlOrRequest, options, send);
      };
    },
  });
}

function requestMethod(urlOrRequest: string | Request, options: RequestOptions): string {
  return (options.method ?? (typeof urlOrRequest === 'string' ? 'GET' : urlOrRequest.method())).toUpperCase();
}

async function reportedCall(
  method: string,
  urlOrRequest: string | Request,
  options: RequestOptions,
  send: () => Promise<APIResponse>,
): Promise<APIResponse> {
  const url = new URL(typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest.url());
  for (const [name, value] of Object.entries(options.params ?? {})) url.searchParams.set(name, String(value));

  return test.step(
    `${method} ${url.pathname}`,
    async () => {
      const request = describeRequest(method, url, options);
      const started = performance.now();
      let response: APIResponse;
      try {
        response = await send();
      } catch (error) {
        const elapsed = Math.round(performance.now() - started);
        recordFailureSignal('network-error', `${method} ${url.pathname}: ${(error as Error).message.split('\n')[0]}`);
        await attachExchange(`${request}\n\nNo response after ${elapsed} ms: ${redactText((error as Error).message)}`);
        throw error;
      }
      const elapsed = Math.round(performance.now() - started);
      if (response.status() >= 500) recordFailureSignal('backend-5xx', `${method} ${url.pathname} -> ${response.status()}`);
      await attachExchange(`${request}\n\n${await describeResponse(response, elapsed)}`);
      return response;
    },
    { box: true },
  );
}

function describeRequest(method: string, url: URL, options: RequestOptions): string {
  const lines = [`${method} ${redactText(url.href)}`];
  const headers = redactHeaders(options.headers ?? {});
  lines.push('', 'Request headers', ...formatHeaders(Object.entries(headers)));
  const body = requestBody(options);
  if (body !== undefined) lines.push('', 'Request body', body);
  return lines.join('\n');
}

function requestBody(options: RequestOptions): string | undefined {
  if (options.form !== undefined) return formatJson(redactJson(options.form));
  if (options.multipart !== undefined) return `multipart fields: ${Object.keys(options.multipart).join(', ')}`;
  const { data } = options;
  if (data === undefined) return undefined;
  if (Buffer.isBuffer(data)) return `<${data.length} bytes>`;
  if (typeof data === 'string') return formatText(data);
  return formatJson(redactJson(data));
}

async function describeResponse(response: APIResponse, elapsed: number): Promise<string> {
  const headers = response.headersArray().map(({ name, value }) => [name, redactHeader(name, value)] as [string, string]);
  const lines = [
    `Status: ${response.status()} ${response.statusText()}`,
    `Duration: ${elapsed} ms`,
    '',
    'Response headers',
    ...formatHeaders(headers),
  ];
  const body = await response.body();
  const contentType = response.headers()['content-type'] ?? '';
  lines.push('', 'Response body');
  if (body.length === 0) lines.push('(empty)');
  else if (/json|text|xml|html/.test(contentType) || contentType === '') lines.push(formatText(body.toString('utf8')));
  else lines.push(`<${body.length} bytes, ${contentType}>`);
  return lines.join('\n');
}

/** JSON is parsed so credential fields are masked by name; anything else is masked as free text. */
function formatText(text: string): string {
  try {
    return formatJson(redactJson(JSON.parse(text)));
  } catch {
    return truncate(redactText(text), MAX_BODY_LENGTH);
  }
}

function formatJson(value: unknown): string {
  return truncate(JSON.stringify(value, null, 2), MAX_BODY_LENGTH);
}

function formatHeaders(headers: [string, string][]): string[] {
  return headers.length === 0 ? ['(none)'] : headers.map(([name, value]) => `${name}: ${value}`);
}

async function attachExchange(text: string): Promise<void> {
  await test.info().attach('HTTP exchange', { body: text, contentType: 'text/plain' });
}
