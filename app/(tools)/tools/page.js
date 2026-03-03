export default function ToolsHome() {
  const tools = [
    { href: "/tools/craft-profit", name: "職人 利益計算（売却 + 結晶）" },
  ];

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Tools</h1>
      <ul className="space-y-2">
        {tools.map((t) => (
          <li key={t.href}>
            <a className="underline" href={t.href}>
              {t.name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
