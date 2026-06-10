(() => {
  const labelForKind = (kind) => ({ comment: 'コメント', social: 'SNS', personal: '体験記', qa: '相談', seo: '記事', web: 'Web' })[kind] || '声';
  const labelForType = (type) => ({ market: '声', case: '体験', risk: 'つまずき', trend: '流れ' })[type] || '声';
  const safe = (value) => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');

  window.researchCard = function researchVoiceCard(item) {
    const kind = labelForKind(item.sourceKind);
    const type = labelForType(item.sourceType);
    const score = Number(item.sourceScore || 0);
    const source = item.sourceName ? `<span>${safe(item.sourceName)}</span>` : `<span>${safe(kind)}</span>`;
    const url = item.url ? `<a href="${safe(item.url)}" target="_blank" rel="noreferrer">元の声を見る</a>` : '';
    return `<article class="research-card voice-card">
      <div class="voice-meta"><span>${safe(type)}</span>${source}${score ? `<small>声らしさ ${score}</small>` : ''}</div>
      <strong>${safe(item.title || item.topic || '似た人の声')}</strong>
      <p class="voice-bubble">${safe(item.finding)}</p>
      <small>${safe(item.whyItMatters || '今日の一歩を軽くするために見ています。')}</small>
      ${url}
    </article>`;
  };

  window.similarTimeline = function similarVoiceTimeline(pattern) {
    const item = pattern || { label: '実際に多かった流れ', summary: '', timeline: ['今あるものを見せる', '近い人に見せる', '少し直す'] };
    return [
      `<article class="similar-head voice-flow-head"><strong>${safe(item.label || '実際に多かった流れ')}</strong><p>${safe(item.summary || item.evidence || '')}</p></article>`,
      ...(Array.isArray(item.timeline) ? item.timeline : []).slice(0, 4).map((step, index) => `<article class="similar-step"><span>${index + 1}</span><p>${safe(step)}</p></article>`)
    ];
  };

  function replaceLabels() {
    document.querySelectorAll('.eyebrow, summary, h2, h3, strong, p').forEach((node) => {
      if (!node.childNodes || node.childNodes.length !== 1 || node.firstChild.nodeType !== Node.TEXT_NODE) return;
      node.textContent = node.textContent
        .replace('市場では', '似た人の声')
        .replace('Web調査から整理しました', '似た人の声から整理しました')
        .replace('似た人の流れ', '実際に多かった流れ')
        .replace('なぜそう見えた？', 'なぜこれが軽そう？')
        .replace('市場', '声');
    });
  }

  function addStyle() {
    if (document.querySelector('#voice-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'voice-ui-style';
    style.textContent = `
      .voice-card{position:relative;overflow:hidden}.voice-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}.voice-meta span,.voice-meta small{border:1px solid rgba(139,187,194,.36);border-radius:999px;background:rgba(220,238,241,.45);color:#527a80;font-size:11px;font-weight:900;padding:5px 9px}.voice-bubble{position:relative;border-radius:18px;background:rgba(255,255,255,.72);border:1px solid rgba(231,222,207,.85);padding:12px 14px;margin:10px 0}.voice-bubble:before{content:'';position:absolute;left:18px;bottom:-8px;width:14px;height:14px;background:rgba(255,255,255,.72);border-right:1px solid rgba(231,222,207,.85);border-bottom:1px solid rgba(231,222,207,.85);transform:rotate(45deg)}.voice-flow-head{background:linear-gradient(135deg,rgba(223,234,217,.76),rgba(220,238,241,.48))}.market-list{grid-template-columns:1fr}.research-card a{border-bottom:1px solid currentColor;text-decoration:none}`;
    document.head.appendChild(style);
  }

  addStyle();
  replaceLabels();
  new MutationObserver(replaceLabels).observe(document.body, { childList: true, subtree: true });
})();
