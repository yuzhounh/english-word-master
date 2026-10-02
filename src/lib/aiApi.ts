import { auth } from './firebase';
import { getApiUrl } from './apiConfig';

export class AiClientError extends Error {}

/** Firebase refreshes an expired ID token before each request, including continuations. */
export async function postAiJson(path: '/api/analyze-text' | '/api/enrich-words', body: unknown) {
  await auth.authStateReady();
  if (!auth.currentUser) throw new AiClientError('请先登录，再使用 AI 补全。');
  let token: string;
  try { token = await auth.currentUser.getIdToken(); }
  catch { throw new AiClientError('登录已失效，请重新登录。'); }
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new AiClientError(data?.error || 'AI 服务暂不可用，请稍后重试。');
  return data;
}
