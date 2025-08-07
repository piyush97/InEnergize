import type { NextApiRequest, NextApiResponse } from 'next';

const KONG_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://inergize-kong:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  
  if (!action || (action !== 'register' && action !== 'login')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use ?action=register or ?action=login'
    });
  }
  
  const targetUrl = `${KONG_GATEWAY_URL}/api/v1/auth/${action}`;
  const fullUrl = targetUrl;
  
  try {
    console.log('Proxying to:', fullUrl);
    console.log('Method:', req.method);
    console.log('Body:', req.body);
    
    const response = await fetch(fullUrl, {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization }),
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Auth proxy error:', error);
    console.error('Target URL was:', fullUrl);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}