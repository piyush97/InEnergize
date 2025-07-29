import axios from 'axios';

const testAuth = async () => {
  try {
    console.log('Testing user registration...');
    
    const registerData = {
      email: 'test-ai-user@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      subscriptionLevel: 'FREE'
    };

    const registerResponse = await axios.post(
      'http://localhost:8000/api/v1/auth/register',
      registerData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    console.log('Registration successful:', registerResponse.data);

    // Now try to login
    console.log('Testing user login...');
    
    const loginData = {
      email: 'test-ai-user@example.com',
      password: 'TestPass123!'
    };

    const loginResponse = await axios.post(
      'http://localhost:8000/api/v1/auth/login',
      loginData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    console.log('Login successful:', loginResponse.data);
    
    if (loginResponse.data.success && loginResponse.data.data.accessToken) {
      console.log('JWT Token:', loginResponse.data.data.accessToken);
      
      // Test AI service with the token
      console.log('Testing AI service with token...');
      
      const aiResponse = await axios.get(
        'http://localhost:8000/api/v1/ai/capabilities',
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginResponse.data.data.accessToken}`
          },
          timeout: 10000
        }
      );
      
      console.log('AI service response:', aiResponse.data);
    }

  } catch (error) {
    console.error('Error during auth testing:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
};

testAuth();