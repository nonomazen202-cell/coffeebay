import './env-loader';

async function test() {
  const baseUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'CoffeeBaySecretKey';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'CoffeeBay';

  console.log(`Checking connection state for instance: ${instanceName} at ${baseUrl}...`);

  const url = `${baseUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      }
    });

    console.log(`Response Status: ${res.status}`);
    const json = await res.json();
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error fetching connection state:', err);
  }
}

test();
