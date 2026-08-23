export default function NotFound() {
  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="not-found-title">
        <p className="access-eyebrow">Field Notes</p>
        <h1 className="access-title" id="not-found-title">页面不存在</h1>
        <p className="access-copy">请检查地址后重试。</p>
        <p className="access-status">未找到可用页面</p>
      </section>
    </main>
  );
}
