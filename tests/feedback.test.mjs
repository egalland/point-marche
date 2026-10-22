import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl, sourceUrl } from './helpers/module-url.mjs';
const feedbackUrl = moduleUrl('../../lib/feedback.ts');
const { feedbackMail, validFeedbackEmail } = await import(feedbackUrl);
test('mail preserves accents and multiline details without injecting recipients or headers', () => {
  const mail = feedbackMail('support+test@example.fr', 'bug', 'Écran & filtre\r\nBcc: test', 'Étape 1\nÉchec & résultat', 'Rubrique : Fournisseurs');
  const url = new URL(mail.url);
  assert.equal(decodeURIComponent(url.pathname), 'support+test@example.fr');
  assert.equal(url.searchParams.size, 2);
  assert.equal(url.searchParams.get('subject').includes('\n'), false);
  assert.match(url.searchParams.get('body'), /Étape 1\nÉchec & résultat/);
  for (const invalid of ['a@b.fr?cc=c@d.fr', 'a@b.fr\r\nBcc:x@y.fr', 'a@b.fr,c@d.fr', '']) assert.equal(validFeedbackEmail(invalid), false);
});
const state = { json: null, fail: false, editor: true };
globalThis.__feedbackTest = state;
const runtime = sourceUrl(`export function getRuntimeEnv() { const s=globalThis.__feedbackTest; return {FILES:{async get(){if(s.fail)throw Error();return s.json?{body:JSON.stringify(s.json)}:null;},async put(key,value){if(s.fail)throw Error();s.json=JSON.parse(new TextDecoder().decode(value));}}}; }`);
const auth = sourceUrl('export async function getEditorUser(){return globalThis.__feedbackTest.editor;}');
const { GET, PUT } = await import(moduleUrl('../../app/api/feedback-settings/route.ts', { '@/lib/runtime-env': runtime, '@/lib/feedback': feedbackUrl, '../../simple-auth': auth }));
const request = email => new Request('https://example.test/api/feedback-settings', { method: 'PUT', body: JSON.stringify({ email }) });
test('shared contact survives reads, rejects invalid changes and reports storage failures', async () => {
  assert.deepEqual(await (await GET()).json(), { email: '' });
  assert.equal((await PUT(request('contact@example.fr'))).status, 200);
  assert.deepEqual(await (await GET()).json(), { email: 'contact@example.fr' });
  assert.equal((await PUT(request('bad'))).status, 400);
  assert.deepEqual(await (await GET()).json(), { email: 'contact@example.fr' });
  state.fail = true;
  assert.equal((await PUT(request('other@example.fr'))).status, 503);
  state.fail = false; state.editor = false;
  assert.equal((await PUT(request('other@example.fr'))).status, 401);
});

test('notification mail supports several recipients without allowing extra headers', async () => {
  const { validFeedbackRecipients } = await import(feedbackUrl);
  assert.equal(validFeedbackRecipients('first@example.fr; second@example.fr'), true);
  assert.equal(validFeedbackRecipients('first@example.fr;bad'), false);
  const mail = feedbackMail('first@example.fr; second@example.fr', 'idea', 'Idée', 'Description', 'USERCODE : A1234567');
  assert.equal(decodeURIComponent(new URL(mail.url).pathname), 'first@example.fr,second@example.fr');
});

test('status changes preserve creation, captures and reporter; stale revisions cannot overwrite history', async () => {
  const { parseFeedbackRequest, updateFeedbackStatus } = await import(feedbackUrl);
  const original = parseFeedbackRequest({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', kind: 'bug', title: 'Test', detail: 'Description', context: 'Marché', captures: [], reporterUserCode: 'a1234567' });
  assert.equal(original.reporterUserCode, 'A1234567');
  assert.equal(original.status, 'Nouveau');
  assert.throws(() => parseFeedbackRequest({ ...original, reporterUserCode: '' }));
  const modified = updateFeedbackStatus(original, 'En cours', 'B7654321', original.updatedAt);
  assert.equal(modified.createdAt, original.createdAt);
  assert.equal(modified.reporterUserCode, original.reporterUserCode);
  assert.equal(modified.history.length, 2);
  assert.equal(modified.history[1].by, 'B7654321');
  assert.throws(() => updateFeedbackStatus(modified, 'Résolu', 'B7654321', 'stale'));
  assert.throws(() => updateFeedbackStatus(modified, 'Unknown', 'B7654321', modified.updatedAt));
});

const inboxState = { files: new Map(), fail: false };
globalThis.__feedbackInboxTest = inboxState;
const inboxRuntime = sourceUrl(`export function getRuntimeEnv(){const s=globalThis.__feedbackInboxTest;return {FILES:{async list({prefix}){return {objects:[...s.files.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false};},async get(key){if(s.fail)throw Error();const raw=s.files.get(key);return raw?{body:raw}:null;},async put(key,value){if(s.fail)throw Error();s.files.set(key,new TextDecoder().decode(value));return {};}}};}`);
const inboxRoute = await import(moduleUrl('../../app/api/feedback/route.ts', { '@/lib/runtime-env': inboxRuntime, '@/lib/feedback': feedbackUrl, '../../simple-auth': sourceUrl('export async function getEditorUser(){return {username:"test"};}') }));
const inboxRequest = (method, body) => new Request('https://example.test/api/feedback', { method, body: JSON.stringify(body) });
test('hosted inbox stores screenshot details separately, retries keep original data and status transitions persist', async () => {
  const draft = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'bug', title: 'Affichage', detail: 'Capture', context: 'Point marché', captures: [{ name: 'image.png', dataUrl: 'data:image/png;base64,aA==' }], reporterUserCode: 'A1234567' };
  assert.equal((await inboxRoute.POST(inboxRequest('POST', draft))).status, 201);
  assert.equal((await inboxRoute.POST(inboxRequest('POST', { ...draft, title: 'Retry' }))).status, 200);
  const list = await (await inboxRoute.GET(new Request('https://example.test/api/feedback'))).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].title, 'Affichage');
  assert.equal(list.items[0].captureCount, 1);
  assert.equal(list.items[0].captures, undefined);
  const detailRequest = new Request(`https://example.test/api/feedback?id=${draft.id}`);
  let item = (await (await inboxRoute.GET(detailRequest)).json()).item;
  const updated = await inboxRoute.PATCH(inboxRequest('PATCH', { id: item.id, status: 'En cours', by: 'B7654321', expectedUpdatedAt: item.updatedAt }));
  assert.equal(updated.status, 200);
  const stale = await inboxRoute.PATCH(inboxRequest('PATCH', { id: item.id, status: 'Résolu', by: 'B7654321', expectedUpdatedAt: item.updatedAt }));
  assert.equal(stale.status, 409);
  item = (await (await inboxRoute.GET(detailRequest)).json()).item;
  assert.equal(item.status, 'En cours');
  assert.equal(item.history.length, 2);
  assert.equal(item.captures[0].dataUrl, draft.captures[0].dataUrl);
  inboxState.fail = true;
  assert.equal((await inboxRoute.POST(inboxRequest('POST', { ...draft, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }))).status, 503);
});
