import { NextApiRequest, NextApiResponse } from 'next';

const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpoint } = req.query;
  const endpointPath = Array.isArray(endpoint) ? endpoint.join('/') : endpoint;

  try {
    // Forward the request to the analytics service
    const url = `${ANALYTICS_SERVICE_URL}/api/v1/predictions/${endpointPath}`;
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
        ...(req.headers as Record<string, string>)
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    
    // Forward the response
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying to analytics service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to analytics service'
    });
  }
}