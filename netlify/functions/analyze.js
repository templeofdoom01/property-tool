exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'API key not configured' }) 
    };
  }

  try {
    console.log('Calling Anthropic API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: event.body
    });

    console.log('Anthropic status:', response.status);
    
    const data = await response.json();
    
    console.log('Anthropic response:', JSON.stringify(data).substring(0, 200));
    
    return {
      statusCode: response.status,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.log('Error:', err.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};
