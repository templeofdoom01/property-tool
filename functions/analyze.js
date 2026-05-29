export async function onRequestPost(context) {
  const { request, env } = context;

  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fetch VREB stats page for current market data
  let vrebStats = '';
  try {
    const vrebRes = await fetch('https://www.vreb.org/market-statistics', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (vrebRes.ok) {
      const html = await vrebRes.text();
      // Extract key benchmark numbers from the page
      const benchmarkMatch = html.match(/benchmark[^$]{0,300}/gi);
      const medianMatch = html.match(/median[^$]{0,200}/gi);
      if (benchmarkMatch) vrebStats += 'VREB Benchmark data: ' + benchmarkMatch.slice(0, 3).join(' | ');
      if (medianMatch) vrebStats += ' Median data: ' + medianMatch.slice(0, 2).join(' | ');
    }
  } catch {
    vrebStats = '';
  }

  // Fetch BC Assessment for the property address
  let bcAssessment = '';
  const address = body.address || '';
  try {
    const searchUrl = `https://www.bcassessment.ca/Property/Search/GetByAddressResult?addressString=${encodeURIComponent(address + ' Victoria BC')}&addressType=Civic&addressId=&locationId=&context=&region=&roll=`;
    const bcRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    if (bcRes.ok) {
      const bcData = await bcRes.json();
      if (bcData && bcData.length > 0) {
        const prop = bcData[0];
        if (prop.AssessedValue) bcAssessment = `BC Assessment value: $${prop.AssessedValue.toLocaleString()}`;
        if (prop.PreviousAssessedValue) bcAssessment += ` (previous year: $${prop.PreviousAssessedValue.toLocaleString()})`;
      }
    }
  } catch {
    bcAssessment = '';
  }

  // Build enhanced messages with real data injected
  const originalMessages = body.messages || [];
  const dataContext = [
    vrebStats ? `LIVE VREB MARKET DATA: ${vrebStats}` : '',
    bcAssessment ? `BC ASSESSMENT DATA: ${bcAssessment}` : '',
    'NOTE: Use the above real data as your primary anchors for the valuation. If VREB or BC Assessment data is unavailable, fall back to Victoria BC market knowledge with April 2026 VREB benchmarks: Single Family $1,183,100 (Victoria Core), Condo $530,200, Townhouse $798,400.'
  ].filter(Boolean).join('\n\n');

  // Inject real data into the first user message
  const enhancedMessages = originalMessages.map((msg, i) => {
    if (i === 0 && msg.role === 'user') {
      return {
        ...msg,
        content: `${dataContext}\n\n---\n\n${msg.content}`
      };
    }
    return msg;
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        ...body,
        messages: enhancedMessages
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Request failed', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
