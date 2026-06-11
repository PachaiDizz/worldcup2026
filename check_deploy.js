async function check() {
  const html = await (await fetch('https://worldcup2026-x6bv.onrender.com/')).text();
  console.log('Has skeleton:', html.includes('sk-grid'));
  console.log('Has favicon:', html.includes('rel="icon"'));
  console.log('Has 48 CHAMPION_CANDIDATES:',
    html.includes('South Africa') &&
    html.includes('Paraguay') &&
    html.includes("Türkiye") &&
    html.includes('Ivory Coast') &&
    html.includes('Jordan')
  );

  const api = await fetch('https://worldcup2026-x6bv.onrender.com/api/scores?from=2026-06-09&to=2026-06-16');
  console.log('API status:', api.status);
  console.log('API body:', (await api.text()).slice(0, 300));
}
check().catch(e => console.log(e));
