/**
 * Picker metadata the two providers report to the seam: `dsh` 0.2.2 web
 * provider pickers read `title` and the localized `description` through
 * `ctx.web.listProviders()`. First-party providers ship eight locales; the
 * descriptions mirror their style — what the provider is suited for and what
 * it costs or cannot do.
 * @module dsh-web-tinyfish/meta
 */

import type { LocalizedText } from '@deepseek-ai/dsh-package-manifest'

/** Display name both providers report; pickers show the id when omitted. */
export const PROVIDER_TITLE = 'TinyFish'

/** Picker description for the search capability. */
export const SEARCH_DESCRIPTION: LocalizedText = {
  en: 'Searches with real browsers through the TinyFish Search API. Requires a TinyFish API key; every search is billed to it.',
  zh: '通过 TinyFish Search API 用真实浏览器搜索。需要 TinyFish API Key，每次搜索都会计费。',
  ja: 'TinyFish Search API を使って実ブラウザで検索します。TinyFish API キーが必要で、検索ごとに課金されます。',
  es: 'Busca con navegadores reales a través de la TinyFish Search API. Requiere una clave de API de TinyFish; cada búsqueda se factura a ella.',
  fr: 'Recherche via la TinyFish Search API avec de vrais navigateurs. Requiert une clé API TinyFish ; chaque recherche lui est facturée.',
  de: 'Sucht über die TinyFish Search API mit echten Browsern. Erfordert einen TinyFish-API-Schlüssel; jede Suche wird darauf abgerechnet.',
  ru: 'Выполняет поиск через TinyFish Search API в реальных браузерах. Требуется ключ API TinyFish; каждый поиск тарифицируется на него.',
  pt: 'Pesquisa com navegadores reais por meio da TinyFish Search API. Requer uma chave de API da TinyFish; cada busca é cobrada nela.',
}

/** Picker description for the fetch capability. */
export const FETCH_DESCRIPTION: LocalizedText = {
  en: 'Fetches pages with a real browser and returns extracted Markdown or HTML. Requires a TinyFish API key; every fetched URL is billed to it.',
  zh: '用真实浏览器抓取页面并返回提取的 Markdown 或 HTML。需要 TinyFish API Key，每个抓取的 URL 都会计费。',
  ja: '実ブラウザでページを取得し、抽出した Markdown または HTML を返します。TinyFish API キーが必要で、取得した URL ごとに課金されます。',
  es: 'Obtiene páginas con un navegador real y devuelve el Markdown o HTML extraído. Requiere una clave de API de TinyFish; cada URL obtenida se factura a ella.',
  fr: 'Récupère les pages avec un vrai navigateur et renvoie le Markdown ou le HTML extrait. Requiert une clé API TinyFish ; chaque URL récupérée lui est facturée.',
  de: 'Lädt Seiten mit einem echten Browser und liefert extrahiertes Markdown oder HTML. Erfordert einen TinyFish-API-Schlüssel; jede geladene URL wird darauf abgerechnet.',
  ru: 'Загружает страницы в реальном браузере и возвращает извлечённый Markdown или HTML. Требуется ключ API TinyFish; каждая загруженная URL тарифицируется на него.',
  pt: 'Busca páginas com um navegador real e retorna o Markdown ou HTML extraído. Requer uma chave de API da TinyFish; cada URL buscada é cobrada nela.',
}
